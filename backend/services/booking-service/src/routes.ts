/**
 * Booking & Optimization Service Routes
 * 
 * Handles booking CRUD, approval workflow, and optimization analytics.
 * The EXCLUDE constraint in Postgres prevents double-booking atomically.
 */

import { FastifyInstance } from 'fastify';
import {
  authMiddleware,
  requireRole,
  getSupabaseClient,
  publishEvent,
  ApiError,
  sendSuccess,
  sendPaginated,
  logger,
} from '@rso/shared';
import type { StreamEvent } from '@rso/shared';
import {
  decideBooking,
  initialBookingStatus,
  isCategoryBookableByRole,
  billableHours,
  calculateBookingCost,
  calculateRefund,
  calculateBumpRefund,
  validateBookingWindow,
} from './booking-rules';

export async function bookingRoutes(server: FastifyInstance): Promise<void> {
  const supabase = getSupabaseClient();

  /**
   * Return tokens for a booking that is no longer going ahead.
   *
   * A cancellation keeps half; a bump returns everything, because the student
   * did not choose to lose the slot. Returns the number of tokens returned,
   * or 0 when there is nothing to refund.
   */
  async function refundBookingTokens(
    bookingId: string,
    bookedBy: string,
    kind: 'cancel' | 'bump',
  ): Promise<number> {
    if (!bookedBy) return 0;

    const { data: tokenBalance } = await supabase
      .from('student_token_balances')
      .select('id, balance')
      .eq('firebase_uid', bookedBy)
      .single();

    if (!tokenBalance) return 0; // not a student, or no balance record

    const { data: deduction } = await supabase
      .from('token_transactions')
      .select('amount')
      .eq('booking_id', bookingId)
      .eq('type', 'booking_deduction')
      .single();

    if (!deduction) return 0; // the booking was free

    // Never refund the same booking twice — a booking can be bumped and then
    // cancelled, and both paths land here.
    const { data: priorRefunds } = await supabase
      .from('token_transactions')
      .select('id')
      .eq('booking_id', bookingId)
      .eq('type', 'booking_refund');

    if (priorRefunds && priorRefunds.length > 0) return 0;

    const amount = kind === 'bump'
      ? calculateBumpRefund(deduction.amount)
      : calculateRefund(deduction.amount);

    if (amount <= 0) return 0;

    await supabase
      .from('student_token_balances')
      .update({ balance: tokenBalance.balance + amount })
      .eq('id', tokenBalance.id);

    // The schema constrains `type` to four values, so a bump reuses
    // booking_refund and is distinguished by its description.
    await supabase.from('token_transactions').insert({
      firebase_uid: bookedBy,
      booking_id: bookingId,
      amount,
      type: 'booking_refund',
      description: kind === 'bump'
        ? `Full refund — booking displaced by a higher-priority user (${amount} tokens)`
        : `50% refund for cancelled booking (${amount} of ${Math.abs(deduction.amount)} tokens)`,
    });

    return amount;
  }

  // ========================================================================
  // GET /api/v1/bookings — List bookings (tenant-scoped, filterable)
  // ========================================================================
  server.get('/api/v1/bookings', {
    preHandler: [authMiddleware],
  }, async (request, reply) => {
    const {
      page = '1', limit = '20',
      resource_id, status, start_date, end_date, my_bookings,
    } = request.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    let query = supabase
      .from('bookings')
      .select('*, resources(name, resource_type, location)', { count: 'exact' });

    // Tenant scoping
    if (request.user!.appRole !== 'main_admin') {
      if (my_bookings !== 'true') {
        const tenantId = request.user!.tenantId;
        if (!tenantId || tenantId === 'null' || tenantId === 'undefined') {
          throw ApiError.forbidden('Your account has no tenant assigned. Please contact an admin.');
        }
        query = query.eq('tenant_id', tenantId);
      }
    }

    if (resource_id) query = query.eq('resource_id', resource_id);
    if (status) query = query.eq('status', status);
    if (my_bookings === 'true') query = query.eq('booked_by', request.user!.sub);
    if (start_date) query = query.gte('start_time', start_date);
    if (end_date) query = query.lte('end_time', end_date);

    const { data, count, error } = await query
      .order('start_time', { ascending: true })
      .range(offset, offset + limitNum - 1);

    if (error) throw error;

    sendPaginated(reply, data || [], count || 0, pageNum, limitNum);
  });

  // ========================================================================
  // GET /api/v1/bookings/:id — Get single booking
  // ========================================================================
  server.get('/api/v1/bookings/:id', {
    preHandler: [authMiddleware],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const { data, error } = await supabase
      .from('bookings')
      .select('*, resources(name, resource_type, location, capacity)')
      .eq('id', id)
      .single();

    if (error || !data) throw ApiError.notFound('Booking');

    if (request.user!.appRole !== 'main_admin' && data.tenant_id !== request.user!.tenantId) {
      throw ApiError.forbidden('This booking belongs to another faculty');
    }

    if (data.booked_by) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('full_name, email, phone, member_id')
        .eq('firebase_uid', data.booked_by)
        .single();
      data.user = profile || null;
    }

    sendSuccess(reply, data);
  });

  // ========================================================================
  // POST /api/v1/bookings — Create a booking
  // ========================================================================
  server.post('/api/v1/bookings', {
    preHandler: [authMiddleware],
  }, async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const user = request.user!;

    if (!body.resource_id || !body.start_time || !body.end_time || !body.title) {
      throw ApiError.badRequest('resource_id, title, start_time, and end_time are required');
    }

    const windowProblem = validateBookingWindow(body.start_time, body.end_time);
    if (windowProblem) throw ApiError.badRequest(windowProblem);

    // Verify resource exists and belongs to user's tenant (or is global)
    const { data: resource } = await supabase
      .from('resources')
      .select('id, tenant_id, is_bookable, status, category, allowed_roles, hourly_cost')
      .eq('id', body.resource_id)
      .single();

    if (!resource) throw ApiError.notFound('Resource');
    
    // Global vs Tenant checks
    if (resource.tenant_id === null) {
      // Global resource
      if (resource.allowed_roles && resource.allowed_roles.length > 0) {
        if (!resource.allowed_roles.includes(user.appRole) && user.appRole !== 'main_admin') {
          throw ApiError.forbidden(`Your role is not allowed to book this global resource. Allowed: ${resource.allowed_roles.join(', ')}`);
        }
      }
    } else {
      if (user.appRole !== 'main_admin' && resource.tenant_id !== user.tenantId) {
        throw ApiError.forbidden('Cannot book resources from another faculty');
      }
    }

    if (!resource.is_bookable) throw ApiError.badRequest('This resource is not bookable');
    if (resource.status !== 'available') throw ApiError.badRequest(`Resource is currently ${resource.status}`);

    // Student restriction — can only book EQUIPMENT and ST_RESOURCE
    if (!isCategoryBookableByRole(user.appRole, resource.category)) {
      throw ApiError.forbidden('Students are only allowed to book EQUIPMENT and Student Shared resources.');
    }

    // Check overlaps
    const { data: overlaps, error: overlapError } = await supabase
      .from('bookings')
      .select('id, booked_by')
      .eq('resource_id', body.resource_id)
      .in('status', ['pending', 'approved', 'active'])
      .lt('start_time', body.end_time)
      .gt('end_time', body.start_time);

    // Must not be swallowed: with no overlap list the priority rules see an
    // empty slot and wave everything through to the database constraint.
    if (overlapError) throw overlapError;

    // Roles are fetched separately rather than embedded. There is no foreign
    // key from bookings.booked_by to user_profiles.firebase_uid, so PostgREST
    // cannot join the two tables.
    const rolesByUid = new Map<string, string>();
    const overlapUids = [...new Set((overlaps || []).map(o => o.booked_by).filter(Boolean))];

    if (overlapUids.length > 0) {
      const { data: profiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('firebase_uid, role')
        .in('firebase_uid', overlapUids);

      if (profileError) throw profileError;
      for (const profile of profiles || []) {
        rolesByUid.set(profile.firebase_uid, profile.role);
      }
    }

    const decision = decideBooking(
      user.appRole,
      (overlaps || []).map(overlap => ({
        id: overlap.id,
        role: rolesByUid.get(overlap.booked_by) || 'student',
      })),
    );

    if (decision.action === 'conflict') {
      throw ApiError.conflict('This time slot is already booked by a user with equal or higher priority.');
    }

    // Keep the owners, so the displaced students can be refunded and told once
    // the replacement booking is confirmed.
    const bumped = (overlaps || [])
      .filter(o => decision.bumpedIds.includes(o.id))
      .map(o => ({ id: o.id as string, bookedBy: o.booked_by as string }));

    if (decision.bumpedIds.length > 0) {
      // Bump lower priority bookings. This has to happen before the insert, or
      // the exclusion constraint rejects the new booking.
      await supabase
        .from('bookings')
        .update({ status: 'bumped' })
        .in('id', decision.bumpedIds);
    }

    const initialStatus = initialBookingStatus(user.appRole);

    // Create booking
    const { data: booking, error } = await supabase
      .from('bookings')
      .insert({
        resource_id: body.resource_id,
        booked_by: user.sub,
        title: body.title,
        purpose: body.purpose,
        start_time: body.start_time,
        end_time: body.end_time,
        status: initialStatus,
        attendee_count: body.attendee_count,
        notes: body.notes,
        recurrence_rule: body.recurrence_rule,
        tenant_id: resource.tenant_id, // For global resources, we insert null or let sync_booking_tenant handle it. Wait, sync_booking_tenant enforces NOT NULL if resource has it, but since we altered resources to allow nullable tenant_id, we should alter bookings.tenant_id too! Wait, bookings.tenant_id is still NOT NULL. Let's fix that in migration.
      })
      .select()
      .single();

    if (error) {
      // 23P01 = exclusion_violation (double-booking race condition)
      if (error.code === '23P01') {
        // Rollback bumped ones manually if needed, but it's edge case
        throw ApiError.conflict('This time slot was just booked by another user');
      }
      throw error;
    }

    // ---- Refund and notify anyone displaced (D-02) ----
    // Only once the replacement booking exists: refunding before the insert
    // would hand tokens back for a bump that never actually happened.
    for (const displaced of bumped) {
      try {
        const refunded = await refundBookingTokens(displaced.id, displaced.bookedBy, 'bump');

        await publishEvent('booking-events', {
          type: 'booking.bumped',
          payload: {
            booking_id: displaced.id,
            displaced_by: user.sub,
            replacement_booking_id: booking.id,
            tokens_refunded: refunded,
          },
          timestamp: new Date().toISOString(),
          tenantId: resource.tenant_id,
        });

        logger.info(
          { bookingId: displaced.id, refunded, by: user.sub },
          'Booking bumped, owner refunded',
        );
      } catch (err) {
        // A failed refund must not fail the booking that triggered it, but it
        // leaves a student out of pocket — so log it loudly.
        logger.error({ err, bookingId: displaced.id }, 'Failed to refund a bumped booking');
      }
    }

    // ---- Student Token Deduction ----
    let tokensDeducted = 0;
    if (user.appRole === 'student' && resource.category === 'EQUIPMENT' && resource.hourly_cost) {
      tokensDeducted = calculateBookingCost(
        resource.hourly_cost,
        body.start_time as string,
        body.end_time as string,
      );

      // Check balance
      const { data: tokenBalance } = await supabase
        .from('student_token_balances')
        .select('id, balance')
        .eq('firebase_uid', user.sub)
        .single();

      if (!tokenBalance || tokenBalance.balance < tokensDeducted) {
        // Rollback: delete the booking we just created
        await supabase.from('bookings').delete().eq('id', booking.id);
        throw ApiError.badRequest(`Insufficient tokens. Need ${tokensDeducted}, have ${tokenBalance?.balance || 0}.`);
      }

      // Deduct tokens
      await supabase
        .from('student_token_balances')
        .update({ balance: tokenBalance.balance - tokensDeducted })
        .eq('id', tokenBalance.id);

      // Log transaction
      await supabase.from('token_transactions').insert({
        firebase_uid: user.sub,
        booking_id: booking.id,
        amount: -tokensDeducted,
        type: 'booking_deduction',
        description: `Booked equipment for ${billableHours(body.start_time as string, body.end_time as string)}h (${resource.hourly_cost} tokens/h)`,
      });
    }

    // Publish event for notification service
    try {
      await publishEvent('booking-events', {
        type: 'booking.created',
        payload: { booking_id: booking.id, resource_id: body.resource_id, booked_by: user.sub },
        timestamp: new Date().toISOString(),
        tenantId: resource.tenant_id,
      });
    } catch (err) {
      logger.warn({ err }, 'Failed to publish booking event (non-fatal)');
    }

    logger.info({ bookingId: booking.id, resourceId: body.resource_id }, 'Booking created');
    sendSuccess(reply, booking, 201);
  });

  // ========================================================================
  // PUT /api/v1/bookings/:id/approve — Approve a booking
  // ========================================================================
  server.put('/api/v1/bookings/:id/approve', {
    preHandler: [authMiddleware, requireRole('tenant_admin', 'main_admin')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user!;

    // Fetch booking first to verify tenant ownership
    const { data: booking, error: fetchErr } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .eq('status', 'pending')
      .single();

    if (fetchErr || !booking) throw ApiError.notFound('Pending booking');

    // Tenant admin: must belong to the same tenant
    if (user.appRole === 'tenant_admin') {
      if (!user.tenantId) {
        throw ApiError.forbidden('Tenant information missing from your account');
      }
      if (booking.tenant_id !== user.tenantId) {
        throw ApiError.forbidden('You cannot manage bookings from another faculty');
      }
    }

    const { data, error } = await supabase
      .from('bookings')
      .update({
        status: 'approved',
        approved_by: user.sub,
        approved_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'pending')
      .select()
      .single();

    if (error || !data) throw ApiError.notFound('Pending booking');

    try {
      await publishEvent('booking-events', {
        type: 'booking.approved',
        payload: { booking_id: id, approved_by: user.sub },
        timestamp: new Date().toISOString(),
        tenantId: data.tenant_id,
      });
    } catch (err) {
      logger.warn({ err }, 'Failed to publish approval event');
    }

    logger.info({ bookingId: id, approvedBy: user.sub }, 'Booking approved');
    sendSuccess(reply, data);
  });

  // ========================================================================
  // PUT /api/v1/bookings/:id/reject — Reject a booking
  // ========================================================================
  server.put('/api/v1/bookings/:id/reject', {
    preHandler: [authMiddleware, requireRole('tenant_admin', 'main_admin')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { reason } = (request.body || {}) as { reason?: string };
    const user = request.user!;

    // Fetch booking first to verify tenant ownership
    const { data: booking, error: fetchErr } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .eq('status', 'pending')
      .single();

    if (fetchErr || !booking) throw ApiError.notFound('Pending booking');

    // Tenant admin: must belong to the same tenant
    if (user.appRole === 'tenant_admin') {
      if (!user.tenantId) {
        throw ApiError.forbidden('Tenant information missing from your account');
      }
      if (booking.tenant_id !== user.tenantId) {
        throw ApiError.forbidden('You cannot manage bookings from another faculty');
      }
    }

    const { data, error } = await supabase
      .from('bookings')
      .update({
        status: 'rejected',
        approved_by: user.sub,
        approved_at: new Date().toISOString(),
        notes: reason,
      })
      .eq('id', id)
      .eq('status', 'pending')
      .select()
      .single();

    if (error || !data) throw ApiError.notFound('Pending booking');

    try {
      await publishEvent('booking-events', {
        type: 'booking.rejected',
        payload: { booking_id: id, rejected_by: user.sub, reason },
        timestamp: new Date().toISOString(),
        tenantId: data.tenant_id,
      });
    } catch (err) {
      logger.warn({ err }, 'Failed to publish rejection event');
    }

    logger.info({ bookingId: id }, 'Booking rejected');
    sendSuccess(reply, data);
  });

  // ========================================================================
  // PUT /api/v1/bookings/:id/cancel — Cancel own booking
  // ========================================================================
  server.put('/api/v1/bookings/:id/cancel', {
    preHandler: [authMiddleware],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user!;

    // Build query — owner or admin can cancel
    let query = supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .in('status', ['pending', 'approved']);

    if (user.appRole !== 'main_admin') {
      if (user.appRole === 'tenant_admin') {
        // Must belong to this tenant
        query = query.eq('tenant_id', user.tenantId);
      } else {
        query = query.eq('booked_by', user.sub);
      }
    }

    const { data, error } = await query.select().single();

    if (error || !data) throw ApiError.notFound('Active booking');

    // ---- Student Token Refund (50%) ----
    const refunded = await refundBookingTokens(id, data.booked_by, 'cancel');
    if (refunded > 0) {
      logger.info({ bookingId: id, refund: refunded }, 'Student tokens partially refunded');
    }

    try {
      await publishEvent('booking-events', {
        type: 'booking.cancelled',
        payload: { booking_id: id, cancelled_by: user.sub },
        timestamp: new Date().toISOString(),
        tenantId: data.tenant_id,
      });
    } catch (err) {
      logger.warn({ err }, 'Failed to publish cancellation event');
    }

    logger.info({ bookingId: id }, 'Booking cancelled');
    sendSuccess(reply, data);
  });

  // ========================================================================
  // PUT /api/v1/bookings/:id — Edit a booking
  // ========================================================================
  server.put('/api/v1/bookings/:id', {
    preHandler: [authMiddleware],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user!;
    const updates = request.body as Record<string, any>;

    // Fetch existing booking
    const { data: existing, error: fetchErr } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) throw ApiError.notFound('Booking');

    if (user.appRole !== 'main_admin') {
      if (user.appRole === 'tenant_admin') {
        if (existing.tenant_id !== user.tenantId) throw ApiError.forbidden('Cannot edit a booking outside your faculty');
      } else {
        if (existing.booked_by !== user.sub) throw ApiError.forbidden("Cannot edit another user's booking");
      }
    }

    const nextStart = updates.start_time !== undefined ? updates.start_time : existing.start_time;
    const nextEnd = updates.end_time !== undefined ? updates.end_time : existing.end_time;

    // Either field can be edited on its own, so validate the resulting window
    // rather than only what was sent (D-04).
    const windowProblem = validateBookingWindow(nextStart, nextEnd);
    if (windowProblem) throw ApiError.badRequest(windowProblem);

    const { data, error } = await supabase
      .from('bookings')
      .update({
        title: updates.title !== undefined ? updates.title : existing.title,
        purpose: updates.purpose !== undefined ? updates.purpose : existing.purpose,
        start_time: nextStart,
        end_time: nextEnd,
        notes: updates.notes !== undefined ? updates.notes : existing.notes,
      })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) throw ApiError.internal('Failed to update booking');

    // Notify booker if changed by an admin
    if (existing.booked_by !== user.sub) {
      try {
        await publishEvent('booking-events', {
          type: 'booking.updated',
          payload: { booking_id: id, updated_by: user.sub },
          timestamp: new Date().toISOString(),
          tenantId: data.tenant_id,
        });
      } catch (err) {
        logger.warn({ err }, 'Failed to publish edit event');
      }
    }

    logger.info({ bookingId: id }, 'Booking edited');
    sendSuccess(reply, data);
  });

  // ========================================================================
  // GET /api/v1/bookings/optimization/stats — Utilization stats
  // ========================================================================
  server.get('/api/v1/bookings/optimization/stats', {
    preHandler: [authMiddleware, requireRole('tenant_admin', 'main_admin')],
  }, async (request, reply) => {
    const tenantId = request.user!.appRole === 'main_admin'
      ? (request.query as any).tenant_id
      : request.user!.tenantId;

    const { data: logs, error } = await supabase
      .from('optimization_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    sendSuccess(reply, { logs: logs || [] });
  });

  // ========================================================================
  // POST /api/v1/bookings/transitions — Auto-transition booking statuses
  // Called by the frontend periodically or on page load
  // approved → active (when current time >= start_time)
  // active → completed (when current time >= end_time)
  // ========================================================================
  server.post('/api/v1/bookings/transitions', {
    preHandler: [authMiddleware],
  }, async (request, reply) => {
    const now = new Date().toISOString();
    let updated = 0;

    // approved → active (booking has started)
    const { data: activated, error: e1 } = await supabase
      .from('bookings')
      .update({ status: 'active' })
      .eq('status', 'approved')
      .lte('start_time', now)
      .select('id');

    if (!e1 && activated) updated += activated.length;

    // active → completed (booking has ended)
    const { data: completed, error: e2 } = await supabase
      .from('bookings')
      .update({ status: 'completed' })
      .eq('status', 'active')
      .lte('end_time', now)
      .select('id');

    if (!e2 && completed) updated += completed.length;

    // Also transition approved bookings that have fully passed
    const { data: missedCompleted, error: e3 } = await supabase
      .from('bookings')
      .update({ status: 'completed' })
      .eq('status', 'approved')
      .lte('end_time', now)
      .select('id');

    if (!e3 && missedCompleted) updated += missedCompleted.length;

    if (updated > 0) {
      logger.info({ updated }, 'Booking statuses transitioned');
    }

    // ---- Monthly Token Renewal ----
    let renewed = 0;
    try {
      const now = new Date();
      const currentMonth = now.toISOString().slice(0, 7); // "2026-07"

      // Find students whose tokens haven't been renewed this month
      const { data: staleBalances } = await supabase
        .from('student_token_balances')
        .select('id, firebase_uid, monthly_quota, last_renewed_at')
        .lt('last_renewed_at', `${currentMonth}-01T00:00:00Z`);

      if (staleBalances && staleBalances.length > 0) {
        for (const sb of staleBalances) {
          await supabase
            .from('student_token_balances')
            .update({ balance: sb.monthly_quota, last_renewed_at: now.toISOString() })
            .eq('id', sb.id);

          await supabase.from('token_transactions').insert({
            firebase_uid: sb.firebase_uid,
            amount: sb.monthly_quota,
            type: 'monthly_renewal',
            description: `Monthly token renewal for ${currentMonth}`,
          });
          renewed++;
        }
        logger.info({ renewed }, 'Student tokens renewed for new month');
      }
    } catch (err) {
      logger.warn({ err }, 'Token renewal failed (non-fatal)');
    }

    sendSuccess(reply, { transitioned: updated, tokens_renewed: renewed });
  });
}

