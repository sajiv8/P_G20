/**
 * User Profile Service Routes
 * 
 * Manages user profiles, signup flow, and role management.
 * Syncs Firebase custom claims on role changes.
 */

import { FastifyInstance } from 'fastify';
import {
  authMiddleware,
  requireRole,
  getSupabaseClient,
  getRedisClient,
  publishEvent,
  ApiError,
  sendSuccess,
  sendPaginated,
  logger,
} from '@rso/shared';
import { initFirebaseAdmin } from './firebase-admin';
import { setUserClaims, updateUserRole, clearUserClaims, getUserClaims } from './firebase-claims';

export async function userRoutes(server: FastifyInstance): Promise<void> {
  const supabase = getSupabaseClient();

  // Initialize Firebase Admin SDK on route registration
  initFirebaseAdmin();

  // ========================================================================
  // GET /api/v1/users/check-tenant/:code — Validate tenant code before signup
  // ========================================================================
  server.get('/api/v1/users/check-tenant/:code', async (request, reply) => {
    const { code } = request.params as { code: string };
    
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('id, name, is_active')
      .eq('code', code)
      .single();

    if (error || !tenant) {
      throw ApiError.notFound('Faculty code is invalid. Please check your faculty code.');
    }
    if (!tenant.is_active) {
      throw ApiError.badRequest('This faculty is currently inactive.');
    }
    
    sendSuccess(reply, { valid: true, tenant_name: tenant.name });
  });
  // ========================================================================
  // POST /api/v1/users/forgot-password — Send reset code to verified email
  // ========================================================================
  server.post('/api/v1/users/forgot-password', async (request, reply) => {
    const { email, member_id } = request.body as { email: string; member_id: string };

    if (!email || !email.includes('@')) {
      throw ApiError.badRequest('A valid email address is required');
    }
    if (!member_id || !member_id.trim()) {
      throw ApiError.badRequest('Member ID is required');
    }

    // Verify email + member_id combination exists
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('firebase_uid, email, full_name, member_id')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (!userProfile) {
      // Don't reveal whether email exists — generic message
      throw ApiError.badRequest('No account found with the provided email and ID combination');
    }

    // Verify member_id matches (case-insensitive)
    if (!userProfile.member_id || userProfile.member_id.toLowerCase() !== member_id.trim().toLowerCase()) {
      throw ApiError.badRequest('No account found with the provided email and ID combination');
    }

    try {
      const { getAuth } = await import('firebase-admin/auth');
      const link = await getAuth().generatePasswordResetLink(email);

      await publishEvent('system-events', {
        type: 'user.password_reset_requested',
        payload: { email, link },
        timestamp: new Date().toISOString(),
        tenantId: 'system',
      });
      logger.info({ email }, 'Password reset link generated and event published');
    } catch (err) {
      logger.error({ err, email }, 'Failed to generate password reset link');
      throw ApiError.internal('Failed to generate reset link. Please try again.');
    }

    sendSuccess(reply, { message: 'If an account exists, a reset link has been sent to your email.' });
  });

  // ========================================================================
  // POST /api/v1/users/reset-password — Verify code and set new password
  // ========================================================================
  server.post('/api/v1/users/reset-password', async (request, reply) => {
    const { email, code, new_password } = request.body as { email: string; code: string; new_password: string };

    if (!email || !code || !new_password) {
      throw ApiError.badRequest('Email, verification code, and new password are required');
    }

    if (new_password.length < 6) {
      throw ApiError.badRequest('Password must be at least 6 characters long');
    }

    const redis = getRedisClient();
    const otpKey = `pwd-reset:${email}`;
    const storedData = await redis.get(otpKey);

    if (!storedData) {
      throw ApiError.badRequest('Reset code has expired. Please request a new one.');
    }

    let parsed: { otp: string; uid: string };
    try {
      parsed = JSON.parse(storedData);
    } catch {
      throw ApiError.badRequest('Invalid reset session. Please request a new code.');
    }

    if (parsed.otp !== code.trim()) {
      throw ApiError.badRequest('Invalid reset code. Please try again.');
    }

    // Update password in Firebase Auth
    try {
      const { getAuth } = await import('firebase-admin/auth');
      await getAuth().updateUser(parsed.uid, { password: new_password });
    } catch (err: any) {
      logger.error({ err, uid: parsed.uid }, 'Failed to reset password in Firebase');
      throw ApiError.internal('Failed to reset password. Please try again.');
    }

    // Clean up Redis
    await redis.del(otpKey);

    logger.info({ email, uid: parsed.uid }, 'Password reset successfully');
    sendSuccess(reply, { message: 'Password reset successfully. You can now log in with your new password.' });
  });

  // ========================================================================
  // POST /api/v1/users/resend-verification — Generate and send verification email
  // ========================================================================
  server.post('/api/v1/users/resend-verification', {
    preHandler: [authMiddleware],
  }, async (request, reply) => {
    const user = request.user!;
    if (!user.email) {
      throw ApiError.badRequest('No email attached to this account.');
    }

    // Double check they aren't already verified
    if ((user as any).email_verified) {
      throw ApiError.badRequest('Email is already verified.');
    }

    try {
      const { getAuth } = await import('firebase-admin/auth');
      const link = await getAuth().generateEmailVerificationLink(user.email);
      
      await publishEvent('system-events', {
        type: 'user.email_verification_requested',
        payload: { email: user.email, link },
        timestamp: new Date().toISOString(),
        tenantId: 'system',
      });
      logger.info({ uid: user.sub, email: user.email }, 'Verification email requested via backend');
    } catch (err) {
      logger.error({ err, uid: user.sub }, 'Failed to generate verification link');
      throw ApiError.internal('Failed to generate verification link.');
    }

    sendSuccess(reply, { message: 'Verification email sent.' });
  });

  // ========================================================================
  // POST /api/v1/users/signup — Create user profile + set Firebase claims
  // ========================================================================
  server.post('/api/v1/users/signup', {
    preHandler: [authMiddleware],
  }, async (request, reply) => {
    const user = request.user!;
    const { tenant_code, full_name, phone, member_id } = request.body as {
      tenant_code: string;
      full_name?: string;
      phone?: string;
      member_id?: string;
    };

    if (!tenant_code) {
      throw ApiError.badRequest('tenant_code is required to join a faculty');
    }

    // Look up tenant by code
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .select('id, name, is_active')
      .eq('code', tenant_code)
      .single();

    if (tenantErr || !tenant) throw ApiError.notFound('Faculty with that code');
    if (!tenant.is_active) throw ApiError.badRequest('This faculty is currently inactive');

    // Check if profile already exists
    const { data: existing } = await supabase
      .from('user_profiles')
      .select('firebase_uid')
      .eq('firebase_uid', user.sub)
      .single();

    if (existing) throw ApiError.conflict('User profile already exists');

    // Create profile
    const { data: profile, error: profileErr } = await supabase
      .from('user_profiles')
      .insert({
        firebase_uid: user.sub,
        tenant_id: tenant.id,
        email: user.email || '',
        full_name: full_name || user.email?.split('@')[0] || '',
        phone: phone || null,
        member_id: member_id || null,
        role: 'student', // Default role on signup
      })
      .select()
      .single();

    if (profileErr) throw profileErr;

    // Create token balance for new student
    await supabase.from('student_token_balances').insert({
      firebase_uid: user.sub,
      tenant_id: tenant.id,
      balance: 100,
      monthly_quota: 100,
    });

    // Log initial token grant
    await supabase.from('token_transactions').insert({
      firebase_uid: user.sub,
      amount: 100,
      type: 'monthly_renewal',
      description: 'Initial token allocation on signup',
    });

    // Set Firebase custom claims
    await setUserClaims(user.sub, tenant.id, 'student');

    logger.info({ uid: user.sub, tenantId: tenant.id }, 'User signed up');

    // Publish event for notification service
    try {
      await publishEvent('system-events', {
        type: 'user.signup',
        payload: { uid: user.sub, email: user.email || '', full_name: full_name || '', tenant_name: tenant.name },
        timestamp: new Date().toISOString(),
        tenantId: tenant.id,
      });

      if (user.email) {
        const { getAuth } = await import('firebase-admin/auth');
        const link = await getAuth().generateEmailVerificationLink(user.email);
        await publishEvent('system-events', {
          type: 'user.email_verification_requested',
          payload: { email: user.email, link },
          timestamp: new Date().toISOString(),
          tenantId: 'system',
        });
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to publish events (non-fatal)');
    }

    sendSuccess(reply, {
      profile,
      claims_set: true,
      message: 'Profile created. Call getIdToken(true) to refresh your token.',
    }, 201);
  });

  // ========================================================================
  // POST /api/v1/users/register — Admin creates a new user account
  // ========================================================================
  server.post('/api/v1/users/register', {
    preHandler: [authMiddleware, requireRole('tenant_admin', 'main_admin')],
  }, async (request, reply) => {
    const { getAuth } = await import('firebase-admin/auth');
    const admin = request.user!;
    const { email, password, full_name, role, member_id, phone, tenant_id } = request.body as {
      email: string;
      password: string;
      full_name: string;
      role?: string;
      member_id?: string;
      phone?: string;
      tenant_id?: string;
    };

    if (!email || !password || !full_name) {
      throw ApiError.badRequest('email, password, and full_name are required');
    }
    if (password.length < 6) {
      throw ApiError.badRequest('Password must be at least 6 characters');
    }

    // Determine tenant
    let targetTenantId = tenant_id || admin.tenantId;
    // If main_admin and no valid tenant, use the first active tenant
    if (!targetTenantId || targetTenantId === 'null' || targetTenantId === 'undefined') {
      const { data: firstTenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('is_active', true)
        .limit(1)
        .single();
      if (firstTenant) targetTenantId = firstTenant.id;
    }

    // Verify tenant exists
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('id', targetTenantId)
      .single();

    if (!tenant) throw ApiError.notFound('Tenant. Please create a faculty/tenant first.');

    // Create Firebase user
    let firebaseUser;
    try {
      firebaseUser = await getAuth().createUser({
        email,
        password,
        displayName: full_name,
      });
    } catch (err: any) {
      if (err.code === 'auth/email-already-exists') {
        throw ApiError.conflict('A user with this email already exists');
      }
      throw err;
    }

    const userRole = role || 'student';

    // Create Supabase profile
    const { data: profile, error: profileErr } = await supabase
      .from('user_profiles')
      .insert({
        firebase_uid: firebaseUser.uid,
        tenant_id: tenant.id,
        email,
        full_name,
        phone: phone || null,
        member_id: member_id || null,
        role: userRole,
      })
      .select()
      .single();

    if (profileErr) {
      // Rollback Firebase user
      try { await getAuth().deleteUser(firebaseUser.uid); } catch {}
      throw profileErr;
    }

    // Set Firebase claims
    await setUserClaims(firebaseUser.uid, tenant.id, userRole as any);

    logger.info({ uid: firebaseUser.uid, createdBy: admin.sub }, 'User registered by admin');
    sendSuccess(reply, profile, 201);
  });

  // ========================================================================
  // GET /api/v1/users/me — Get own profile
  // ========================================================================
  server.get('/api/v1/users/me', {
    preHandler: [authMiddleware],
  }, async (request, reply) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*, tenants(name, code, slug)')
      .eq('firebase_uid', request.user!.sub)
      .single();

    if (error || !data) throw ApiError.notFound('User profile');

    sendSuccess(reply, data);
  });

  // ========================================================================
  // GET /api/v1/users — List users in tenant (paginated)
  // ========================================================================
  server.get('/api/v1/users', {
    preHandler: [authMiddleware, requireRole('tenant_admin', 'main_admin')],
  }, async (request, reply) => {
    const { page = '1', limit = '20', role, search, tenant_id } = request.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    let query = supabase.from('user_profiles').select('*', { count: 'exact' });

    // Tenant scoping — main_admin sees all users unless filtering by tenant
    if (request.user!.appRole === 'main_admin') {
      // Only filter by tenant if explicitly requested
      if (tenant_id && tenant_id !== 'null' && tenant_id !== 'undefined') {
        query = query.eq('tenant_id', tenant_id);
      }
      // Otherwise: no tenant filter — show all users
    } else {
      // Non-super admins: always scoped to their own tenant
      const tid = request.user!.tenantId;
      if (tid && tid !== 'null' && tid !== 'undefined') {
        query = query.eq('tenant_id', tid);
      }
    }

    if (role) query = query.eq('role', role);
    if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (error) throw error;

    sendPaginated(reply, data || [], count || 0, pageNum, limitNum);
  });

  // ========================================================================
  // GET /api/v1/users/:uid — Get a specific user
  // ========================================================================
  server.get('/api/v1/users/:uid', {
    preHandler: [authMiddleware],
  }, async (request, reply) => {
    const { uid } = request.params as { uid: string };
    const user = request.user!;

    // Users can view themselves; admins can view anyone in their tenant
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('firebase_uid', uid)
      .single();

    if (error || !data) throw ApiError.notFound('User');

    // Check access
    if (uid !== user.sub && user.appRole !== 'main_admin') {
      if (user.appRole !== 'tenant_admin' || data.tenant_id !== user.tenantId) {
        throw ApiError.forbidden('You can only view users in your own faculty');
      }
    }

    sendSuccess(reply, data);
  });

  // ========================================================================
  // PUT /api/v1/users/:uid — Update user profile
  // ========================================================================
  server.put('/api/v1/users/:uid', {
    preHandler: [authMiddleware],
  }, async (request, reply) => {
    const { uid } = request.params as { uid: string };
    const user = request.user!;

    // Users can update themselves; tenant_admins can update anyone in their tenant
    if (uid !== user.sub && user.appRole !== 'main_admin') {
      if (user.appRole !== 'tenant_admin') {
        throw ApiError.forbidden('You can only update your own profile');
      }
    }

    const updates = request.body as Record<string, unknown>;
    // Prevent changing immutable fields
    delete updates.firebase_uid;
    delete updates.created_at;
    delete updates.tenant_id; // Can't switch tenants via this endpoint

    // Non-admins can't change their own role
    if (uid === user.sub && user.appRole !== 'main_admin') {
      delete updates.role;
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('firebase_uid', uid)
      .select()
      .single();

    if (error || !data) throw ApiError.notFound('User');

    logger.info({ uid, updatedBy: user.sub }, 'User profile updated');
    sendSuccess(reply, data);
  });

  // ========================================================================
  // PUT /api/v1/users/:uid/role — Change a user's role and/or tenant (admin only)
  // ========================================================================
  server.put('/api/v1/users/:uid/role', {
    preHandler: [authMiddleware, requireRole('tenant_admin', 'main_admin')],
  }, async (request, reply) => {
    const { uid } = request.params as { uid: string };
    const { role, tenant_id } = request.body as { role: string; tenant_id?: string };

    if (!role) throw ApiError.badRequest('role is required');

    const validRoles = ['student', 'lecturer', 'tenant_admin', 'staff'];
    if (request.user!.appRole !== 'main_admin') {
      // Tenant admins can't create main_admins
      if (role === 'main_admin') throw ApiError.forbidden('Only main_admin can assign main_admin role');
    } else {
      validRoles.push('main_admin');
    }

    if (!validRoles.includes(role)) {
      throw ApiError.badRequest(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }

    // Get current user to verify access and current tenant
    const { data: currentUser, error: userErr } = await supabase
      .from('user_profiles')
      .select('tenant_id')
      .eq('firebase_uid', uid)
      .single();

    if (userErr || !currentUser) throw ApiError.notFound('User');

    if (request.user!.appRole !== 'main_admin') {
      if (currentUser.tenant_id !== request.user!.tenantId) {
         throw ApiError.forbidden('Cannot modify users outside your faculty');
      }
      if (tenant_id && tenant_id !== request.user!.tenantId) {
         throw ApiError.forbidden('Cannot assign user to a different faculty');
      }
    }

    // Determine final tenant_id
    const finalTenantId = tenant_id !== undefined ? tenant_id : currentUser.tenant_id;
    
    if (role !== 'main_admin' && (!finalTenantId || finalTenantId === 'null' || finalTenantId === 'undefined')) {
      throw ApiError.badRequest('A valid tenant is required for all roles except main_admin');
    }

    // Update in Supabase
    const updateData: any = { role };
    if (tenant_id !== undefined) {
      updateData.tenant_id = tenant_id === 'null' ? null : tenant_id;
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .update(updateData)
      .eq('firebase_uid', uid)
      .select()
      .single();

    if (error || !data) throw ApiError.notFound('User');

    // Sync Firebase custom claims
    if (tenant_id !== undefined) {
      const { setUserClaims } = await import('./firebase-claims');
      await setUserClaims(uid, data.tenant_id, role as any);
    } else {
      const { updateUserRole } = await import('./firebase-claims');
      await updateUserRole(uid, role as any);
    }

    logger.info({ uid, newRole: role, newTenant: data.tenant_id, changedBy: request.user!.sub }, 'User role/tenant changed');

    // Publish event for notification service
    try {
      await publishEvent('system-events', {
        type: 'user.role_changed',
        payload: { uid, email: data.email, full_name: data.full_name, new_role: role, changed_by: request.user!.sub },
        timestamp: new Date().toISOString(),
        tenantId: data.tenant_id || 'system',
      });
    } catch (err) {
      logger.warn({ err }, 'Failed to publish user.role_changed event (non-fatal)');
    }

    sendSuccess(reply, {
      profile: data,
      claims_updated: true,
      message: 'Role updated. User must call getIdToken(true) to refresh.',
    });
  });

  // ========================================================================
  // PUT /api/v1/users/:uid/ban — Main admin bans a user temporarily
  // ========================================================================
  server.put('/api/v1/users/:uid/ban', {
    preHandler: [authMiddleware, requireRole('main_admin')],
  }, async (request, reply) => {
    const { uid } = request.params as { uid: string };
    const { reason } = request.body as { reason?: string };

    // Can't ban yourself
    if (uid === request.user!.sub) {
      throw ApiError.badRequest('You cannot ban yourself');
    }

    // Can't ban other main_admins
    const { data: targetUser } = await supabase
      .from('user_profiles')
      .select('role, full_name')
      .eq('firebase_uid', uid)
      .single();

    if (!targetUser) throw ApiError.notFound('User');
    if (targetUser.role === 'main_admin') {
      throw ApiError.forbidden('Cannot ban another main admin');
    }

    // Update is_active in database
    await supabase
      .from('user_profiles')
      .update({ is_active: false })
      .eq('firebase_uid', uid);

    // Set is_banned claim in Firebase
    const { getAuth } = await import('firebase-admin/auth');
    try {
      const currentClaims = (await getAuth().getUser(uid)).customClaims || {};
      await getAuth().setCustomUserClaims(uid, {
        ...currentClaims,
        is_banned: true,
        ban_reason: reason || 'Suspended by administrator',
      });
      // Revoke refresh tokens to force re-auth
      await getAuth().revokeRefreshTokens(uid);
    } catch (err) {
      logger.error({ err, uid }, 'Failed to set ban claims in Firebase');
    }

    logger.info({ uid, bannedBy: request.user!.sub, reason }, 'User banned');

    // Publish event for notification service
    try {
      const { data: bannedProfile } = await supabase.from('user_profiles').select('email, tenant_id').eq('firebase_uid', uid).single();
      await publishEvent('system-events', {
        type: 'user.banned',
        payload: { uid, email: bannedProfile?.email || '', full_name: targetUser.full_name || '', reason: reason || 'Suspended by administrator' },
        timestamp: new Date().toISOString(),
        tenantId: bannedProfile?.tenant_id || 'system',
      });
    } catch (err) {
      logger.warn({ err }, 'Failed to publish user.banned event (non-fatal)');
    }

    sendSuccess(reply, { message: `User ${targetUser.full_name || uid} has been suspended` });
  });

  // ========================================================================
  // PUT /api/v1/users/:uid/unban — Main admin unbans a user
  // ========================================================================
  server.put('/api/v1/users/:uid/unban', {
    preHandler: [authMiddleware, requireRole('main_admin')],
  }, async (request, reply) => {
    const { uid } = request.params as { uid: string };

    // Update is_active in database
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ is_active: true })
      .eq('firebase_uid', uid)
      .select('full_name')
      .single();

    if (error || !data) throw ApiError.notFound('User');

    // Remove is_banned claim in Firebase
    const { getAuth } = await import('firebase-admin/auth');
    try {
      const currentClaims = (await getAuth().getUser(uid)).customClaims || {};
      delete currentClaims.is_banned;
      delete currentClaims.ban_reason;
      await getAuth().setCustomUserClaims(uid, currentClaims);
    } catch (err) {
      logger.error({ err, uid }, 'Failed to remove ban claims in Firebase');
    }

    logger.info({ uid, unbannedBy: request.user!.sub }, 'User unbanned');

    // Publish event for notification service
    try {
      const { data: unbannedProfile } = await supabase.from('user_profiles').select('email, tenant_id').eq('firebase_uid', uid).single();
      await publishEvent('system-events', {
        type: 'user.unbanned',
        payload: { uid, email: unbannedProfile?.email || '', full_name: data.full_name || '' },
        timestamp: new Date().toISOString(),
        tenantId: unbannedProfile?.tenant_id || 'system',
      });
    } catch (err) {
      logger.warn({ err }, 'Failed to publish user.unbanned event (non-fatal)');
    }

    sendSuccess(reply, { message: `User ${data.full_name || uid} has been reactivated` });
  });

  // ========================================================================
  // DELETE /api/v1/users/:uid — Delete user account
  // Admin can delete anyone; users can delete themselves
  // ========================================================================
  server.delete('/api/v1/users/:uid', {
    preHandler: [authMiddleware],
  }, async (request, reply) => {
    const { uid } = request.params as { uid: string };
    const user = request.user!;

    // Authorization: self or admin
    if (uid !== user.sub && user.appRole !== 'main_admin' && user.appRole !== 'tenant_admin') {
      throw ApiError.forbidden('You can only delete your own account');
    }

    // Security check: tenant_admin can only delete users in their own tenant
    if (uid !== user.sub && user.appRole === 'tenant_admin') {
      const { data: targetUser } = await supabase
        .from('user_profiles')
        .select('tenant_id, role')
        .eq('firebase_uid', uid)
        .single();
        
      if (!targetUser) throw ApiError.notFound('User');
      if (targetUser.tenant_id !== user.tenantId) {
        throw ApiError.forbidden('You can only delete users in your own faculty');
      }
      if (targetUser.role === 'main_admin') {
        throw ApiError.forbidden('You cannot delete a main_admin');
      }
    }

    // First: delete or nullify user's bookings (FK constraint)
    await supabase
      .from('bookings')
      .delete()
      .eq('booked_by', uid)
      .in('status', ['pending', 'cancelled', 'rejected']);

    // Update remaining bookings (approved/active/completed) to remove booked_by reference
    // Actually, just delete all bookings for this user to avoid FK issues
    await supabase
      .from('bookings')
      .delete()
      .eq('booked_by', uid);

    // Delete profile from Supabase
    const { data, error } = await supabase
      .from('user_profiles')
      .delete()
      .eq('firebase_uid', uid)
      .select()
      .single();

    if (error) {
      logger.error({ uid, error: error.message }, 'Failed to delete user profile');
      throw ApiError.internal(`Failed to delete user: ${error.message}`);
    }
    if (!data) throw ApiError.notFound('User');

    // Delete from Firebase Auth
    try {
      const { getAuth } = await import('firebase-admin/auth');
      await getAuth().deleteUser(uid);
    } catch (err: any) {
      logger.warn({ uid, error: err.message }, 'Failed to delete Firebase user (may not exist)');
    }

    logger.info({ uid, deletedBy: user.sub }, 'User account deleted');

    // Publish event for notification service
    try {
      await publishEvent('system-events', {
        type: 'user.deleted',
        payload: { uid, email: data.email || '', full_name: data.full_name || '', deleted_by: user.sub },
        timestamp: new Date().toISOString(),
        tenantId: data.tenant_id || 'system',
      });
    } catch (err) {
      logger.warn({ err }, 'Failed to publish user.deleted event (non-fatal)');
    }

    sendSuccess(reply, { message: 'User account deleted' });
  });

  // ========================================================================
  // POST /api/v1/users/:uid/avatar — Upload avatar image (base64)
  // ========================================================================
  server.post('/api/v1/users/:uid/avatar', {
    preHandler: [authMiddleware],
  }, async (request, reply) => {
    const { uid } = request.params as { uid: string };
    const user = request.user!;

    // Authorization: self or admin
    if (uid !== user.sub && user.appRole !== 'main_admin' && user.appRole !== 'tenant_admin') {
      throw ApiError.forbidden('You can only update your own avatar');
    }

    const { image, filename } = request.body as { image: string; filename: string };
    if (!image) throw ApiError.badRequest('image (base64) is required');

    const ext = (filename || 'avatar.jpg').split('.').pop()?.toLowerCase() || 'jpg';
    const allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    if (!allowed.includes(ext)) {
      throw ApiError.badRequest(`File type .${ext} not allowed. Use: ${allowed.join(', ')}`);
    }

    // Decode base64 — handle both raw base64 and data URI formats
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64Data, 'base64');
    } catch {
      throw ApiError.badRequest('Invalid base64 image data');
    }

    if (buffer.length === 0) {
      throw ApiError.badRequest('Image data is empty');
    }

    if (buffer.length > 2 * 1024 * 1024) {
      throw ApiError.badRequest('File too large. Max 2MB');
    }

    const fileName = `${uid}_${Date.now()}.${ext}`;
    const uploadDir = '/app/uploads/avatars';

    // Write file to disk
    try {
      const { mkdir, writeFile } = await import('fs/promises');
      await mkdir(uploadDir, { recursive: true });
      await writeFile(`${uploadDir}/${fileName}`, buffer);
    } catch (fsErr) {
      logger.error({ err: fsErr, uploadDir, fileName }, 'Failed to write avatar file');
      throw ApiError.internal('Failed to save avatar file');
    }

    const avatarUrl = `/uploads/avatars/${fileName}`;

    // Update user profile
    const { error: dbErr } = await supabase
      .from('user_profiles')
      .update({ avatar_url: avatarUrl })
      .eq('firebase_uid', uid);

    if (dbErr) {
      logger.error({ err: dbErr, uid }, 'Failed to update avatar_url in database');
      throw ApiError.internal('Failed to update avatar in profile');
    }

    logger.info({ uid, avatarUrl }, 'Avatar uploaded');
    sendSuccess(reply, { avatar_url: avatarUrl });
  });

  // ========================================================================
  // GET /api/v1/users/me/tokens — Get own token balance & recent transactions
  // ========================================================================
  server.get('/api/v1/users/me/tokens', {
    preHandler: [authMiddleware],
  }, async (request, reply) => {
    const uid = request.user!.sub;

    const { data: balance } = await supabase
      .from('student_token_balances')
      .select('*')
      .eq('firebase_uid', uid)
      .single();

    if (!balance) {
      return sendSuccess(reply, { balance: null, transactions: [] });
    }

    const { data: transactions } = await supabase
      .from('token_transactions')
      .select('*')
      .eq('firebase_uid', uid)
      .order('created_at', { ascending: false })
      .limit(20);

    sendSuccess(reply, { balance, transactions: transactions || [] });
  });

  // ========================================================================
  // PUT /api/v1/users/tokens/bulk — Admin: set monthly quota for ALL students
  // ========================================================================
  server.put('/api/v1/users/tokens/bulk', {
    preHandler: [authMiddleware, requireRole('tenant_admin', 'main_admin')],
  }, async (request, reply) => {
    const { monthly_quota, reset_balance } = request.body as { monthly_quota: number; reset_balance?: boolean };

    if (!monthly_quota || monthly_quota < 0) {
      throw ApiError.badRequest('monthly_quota must be a positive number');
    }

    const user = request.user!;
    let query = supabase.from('student_token_balances').update({
      monthly_quota,
      ...(reset_balance ? { balance: monthly_quota } : {}),
    });

    // Tenant admin only updates their own tenant's students
    if (user.appRole === 'tenant_admin') {
      query = query.eq('tenant_id', user.tenantId);
    }

    const { error, count } = await query.select('id');
    if (error) throw error;

    logger.info({ monthly_quota, reset_balance, updatedBy: user.sub }, 'Bulk token update');
    sendSuccess(reply, { message: `Updated ${count || 0} students`, monthly_quota });
  });

  // ========================================================================
  // GET /api/v1/users/:uid/tokens — Admin: get a specific student's tokens
  // ========================================================================
  server.get('/api/v1/users/:uid/tokens', {
    preHandler: [authMiddleware, requireRole('tenant_admin', 'main_admin')],
  }, async (request, reply) => {
    const { uid } = request.params as { uid: string };

    const { data: balance } = await supabase
      .from('student_token_balances')
      .select('*')
      .eq('firebase_uid', uid)
      .single();

    if (!balance) {
      return sendSuccess(reply, { balance: null, transactions: [] });
    }

    const { data: transactions } = await supabase
      .from('token_transactions')
      .select('*')
      .eq('firebase_uid', uid)
      .order('created_at', { ascending: false })
      .limit(20);

    sendSuccess(reply, { balance, transactions: transactions || [] });
  });

  // ========================================================================
  // PUT /api/v1/users/:uid/tokens — Admin: adjust a specific student's tokens
  // ========================================================================
  server.put('/api/v1/users/:uid/tokens', {
    preHandler: [authMiddleware, requireRole('tenant_admin', 'main_admin')],
  }, async (request, reply) => {
    const { uid } = request.params as { uid: string };
    const { balance, monthly_quota } = request.body as { balance?: number; monthly_quota?: number };

    const updates: Record<string, any> = {};
    if (balance !== undefined) updates.balance = balance;
    if (monthly_quota !== undefined) updates.monthly_quota = monthly_quota;

    if (Object.keys(updates).length === 0) {
      throw ApiError.badRequest('Provide balance or monthly_quota to update');
    }

    const { data, error } = await supabase
      .from('student_token_balances')
      .update(updates)
      .eq('firebase_uid', uid)
      .select()
      .single();

    if (error || !data) throw ApiError.notFound('Student token balance');

    // Log admin adjustment
    await supabase.from('token_transactions').insert({
      firebase_uid: uid,
      amount: balance !== undefined ? balance - (data.balance || 0) : 0,
      type: 'admin_adjustment',
      description: `Adjusted by admin ${request.user!.sub}`,
    });

    logger.info({ uid, updates, adjustedBy: request.user!.sub }, 'Student tokens adjusted');
    sendSuccess(reply, data);
  });
}

