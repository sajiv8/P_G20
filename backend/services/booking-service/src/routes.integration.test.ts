/**
 * Integration tests for the booking routes.
 *
 * These drive the real Fastify app through `inject()`, so routing, the auth
 * hook, the RBAC guard, the booking rules and the shared error handler all run
 * for real. Only the two outside systems are faked: Supabase and Firebase.
 */

import type { FastifyInstance } from 'fastify';
import { getSupabaseClient } from '@rso/shared';
import { buildServer } from './server';
import { createSupabaseMock } from './test-helpers/supabase-mock';
import { authState, signInAs, signOut, TestUser } from './test-helpers/auth-state';

jest.mock('@rso/shared', () => {
  const actual = jest.requireActual('@rso/shared');
  const { authState: state } = jest.requireActual('./test-helpers/auth-state');

  return {
    ...actual,
    // Faked: the outside world.
    getSupabaseClient: jest.fn(),
    publishEvent: jest.fn().mockResolvedValue(undefined),
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    authMiddleware: jest.fn(async (request: any, reply: any) => {
      if (!state.user) {
        reply.code(401).send({
          success: false,
          error: { code: 'AUTH_MISSING_TOKEN', message: 'Authorization header with Bearer token is required' },
        });
        return;
      }
      request.user = state.user;
    }),
    // Real: ApiError, errorHandler, sendSuccess, sendPaginated, requireRole.
  };
});

const supabase = createSupabaseMock();

const STUDENT: TestUser = { sub: 'student-1', email: 's1@test.local', tenantId: 'tenant-a', appRole: 'student' };
const LECTURER: TestUser = { sub: 'lecturer-1', email: 'l1@test.local', tenantId: 'tenant-a', appRole: 'lecturer' };
const TENANT_ADMIN: TestUser = { sub: 'admin-1', email: 'a1@test.local', tenantId: 'tenant-a', appRole: 'tenant_admin' };

/** A bookable, available piece of equipment in tenant-a. */
const equipment = (overrides: Record<string, unknown> = {}) => ({
  id: 'resource-1',
  tenant_id: 'tenant-a',
  is_bookable: true,
  status: 'available',
  category: 'EQUIPMENT',
  allowed_roles: null,
  hourly_cost: null,
  ...overrides,
});

/** A two-hour window, well into the future. */
const TWO_HOUR_SLOT = {
  start_time: '2027-03-01T10:00:00.000Z',
  end_time: '2027-03-01T12:00:00.000Z',
};

const validBooking = (overrides: Record<string, unknown> = {}) => ({
  resource_id: 'resource-1',
  title: 'Test Booking',
  ...TWO_HOUR_SLOT,
  ...overrides,
});

let app: FastifyInstance;

beforeEach(() => {
  supabase.reset();
  signOut();
  (getSupabaseClient as jest.Mock).mockReturnValue(supabase.client);
  app = buildServer();
});

afterEach(async () => {
  await app.close();
});

const postBooking = (payload: Record<string, unknown>) =>
  app.inject({ method: 'POST', url: '/api/v1/bookings', payload });

describe('GET /health', () => {
  it('reports the service as ok without authentication', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', service: 'booking-service' });
  });
});

describe('POST /api/v1/bookings — access and validation', () => {
  // TC-AUTH-14
  it('rejects an unauthenticated request with 401', async () => {
    const res = await postBooking(validBooking());

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('AUTH_MISSING_TOKEN');
  });

  // TC-BOOK-13
  it('rejects a request with no title', async () => {
    signInAs(STUDENT);

    const res = await postBooking({ resource_id: 'resource-1', ...TWO_HOUR_SLOT });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/required/i);
    expect(supabase.calls).toHaveLength(0);
  });

  // TC-BOOK-12 / D-04 — rejected before any database call is made.
  it('rejects a booking whose end is before its start', async () => {
    signInAs(STUDENT);

    const res = await postBooking(validBooking({
      start_time: '2027-03-01T12:00:00.000Z',
      end_time: '2027-03-01T10:00:00.000Z',
    }));

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/after start_time/);
    expect(supabase.calls).toHaveLength(0);
  });

  it('rejects a booking with an unparseable date', async () => {
    signInAs(STUDENT);

    const res = await postBooking(validBooking({ end_time: 'next tuesday' }));

    expect(res.statusCode).toBe(400);
    expect(supabase.calls).toHaveLength(0);
  });

  it('returns 404 when the resource does not exist', async () => {
    signInAs(STUDENT);
    supabase.queueResults({ data: null });

    const res = await postBooking(validBooking());

    expect(res.statusCode).toBe(404);
  });

  // TC-RBAC-09
  it('stops a user booking a resource from another faculty', async () => {
    signInAs(STUDENT);
    supabase.queueResults({ data: equipment({ tenant_id: 'tenant-b' }) });

    const res = await postBooking(validBooking());

    expect(res.statusCode).toBe(403);
    expect(res.json().error.message).toMatch(/another faculty/i);
  });

  // TC-BOOK-14
  it('rejects a resource that is not bookable', async () => {
    signInAs(STUDENT);
    supabase.queueResults({ data: equipment({ is_bookable: false }) });

    const res = await postBooking(validBooking());

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/not bookable/i);
  });

  // TC-BOOK-15
  it('rejects a resource that is under maintenance', async () => {
    signInAs(STUDENT);
    supabase.queueResults({ data: equipment({ status: 'maintenance' }) });

    const res = await postBooking(validBooking());

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/maintenance/i);
  });

  // TC-BOOK-03
  it('stops a student booking a lecture hall', async () => {
    signInAs(STUDENT);
    supabase.queueResults({ data: equipment({ category: 'LECTURE_HALL' }) });

    const res = await postBooking(validBooking());

    expect(res.statusCode).toBe(403);
    expect(res.json().error.message).toMatch(/EQUIPMENT and Student Shared/i);
  });

  // TC-BOOK-16
  it('enforces allowed_roles on a global resource', async () => {
    signInAs(STUDENT);
    supabase.queueResults({
      data: equipment({ tenant_id: null, allowed_roles: ['lecturer', 'tenant_admin'] }),
    });

    const res = await postBooking(validBooking());

    expect(res.statusCode).toBe(403);
    expect(res.json().error.message).toMatch(/not allowed/i);
  });
});

describe('POST /api/v1/bookings — priority and conflicts', () => {
  // TC-BOOK-01
  it('creates a student booking as pending', async () => {
    signInAs(STUDENT);
    supabase.queueResults(
      { data: equipment() },
      { data: [] },
      { data: { id: 'booking-1', status: 'pending' } },
    );

    const res = await postBooking(validBooking());

    expect(res.statusCode).toBe(201);
    expect(res.json().data.id).toBe('booking-1');
    expect(supabase.findCall('bookings', 'insert')?.payload).toMatchObject({ status: 'pending' });
  });

  // TC-BOOK-02
  it('auto-approves a lecturer booking', async () => {
    signInAs(LECTURER);
    supabase.queueResults(
      { data: equipment() },
      { data: [] },
      { data: { id: 'booking-2', status: 'approved' } },
    );

    const res = await postBooking(validBooking());

    expect(res.statusCode).toBe(201);
    expect(supabase.findCall('bookings', 'insert')?.payload).toMatchObject({ status: 'approved' });
  });

  // TC-BOOK-04
  it('returns 409 when an equal-priority booking already holds the slot', async () => {
    signInAs(STUDENT);
    supabase.queueResults(
      { data: equipment() },
      { data: [{ id: 'booking-0', booked_by: 'student-9' }] },
      { data: [{ firebase_uid: 'student-9', role: 'student' }] },
    );

    const res = await postBooking(validBooking());

    expect(res.statusCode).toBe(409);
    expect(res.json().error.message).toMatch(/equal or higher priority/i);
    expect(supabase.findCall('bookings', 'insert')).toBeUndefined();
  });

  // TC-BOOK-06
  it('returns 409 when a student tries to take a lecturer’s slot', async () => {
    signInAs(STUDENT);
    supabase.queueResults(
      { data: equipment() },
      { data: [{ id: 'booking-0', booked_by: 'lecturer-9' }] },
      { data: [{ firebase_uid: 'lecturer-9', role: 'lecturer' }] },
    );

    const res = await postBooking(validBooking());

    expect(res.statusCode).toBe(409);
  });

  // TC-BOOK-05
  it('lets a lecturer bump a student and marks the old booking bumped', async () => {
    signInAs(LECTURER);
    supabase.queueResults(
      { data: equipment() },
      { data: [{ id: 'booking-0', booked_by: 'student-9' }] },
      { data: [{ firebase_uid: 'student-9', role: 'student' }] },
      { data: null },
      { data: { id: 'booking-3', status: 'approved' } },
    );

    const res = await postBooking(validBooking());

    expect(res.statusCode).toBe(201);
    expect(supabase.findCall('bookings', 'update')?.payload).toEqual({ status: 'bumped' });
  });

  it('does not bump anyone when one of several overlaps outranks the requester', async () => {
    signInAs(LECTURER);
    supabase.queueResults(
      { data: equipment() },
      {
        data: [
          { id: 'booking-a', booked_by: 'student-9' },
          { id: 'booking-b', booked_by: 'admin-9' },
        ],
      },
      {
        data: [
          { firebase_uid: 'student-9', role: 'student' },
          { firebase_uid: 'admin-9', role: 'main_admin' },
        ],
      },
    );

    const res = await postBooking(validBooking());

    expect(res.statusCode).toBe(409);
    expect(supabase.findCall('bookings', 'update')).toBeUndefined();
    expect(supabase.findCall('bookings', 'insert')).toBeUndefined();
  });

  // TC-TOK-07 / D-02 regression: a displaced student must get their tokens back.
  it('refunds the full charge to a student it bumps', async () => {
    signInAs(LECTURER);
    supabase.queueResults(
      { data: equipment({ hourly_cost: 10 }) },
      { data: [{ id: 'booking-0', booked_by: 'student-9' }] },
      { data: [{ firebase_uid: 'student-9', role: 'student' }] },
      { data: null }, // bump update
      { data: { id: 'booking-9', status: 'approved' } }, // insert
      { data: { id: 'balance-9', balance: 50 } }, // displaced student's balance
      { data: { amount: -20 } }, // their original deduction
      { data: [] }, // no prior refund
      { data: null }, // balance update
      { data: null }, // refund transaction
    );

    const res = await postBooking(validBooking());

    expect(res.statusCode).toBe(201);
    // The whole 20 comes back, not half: 50 + 20 = 70.
    expect(supabase.findCall('student_token_balances', 'update')?.payload).toEqual({ balance: 70 });
    expect(supabase.findCall('token_transactions', 'insert')?.payload).toMatchObject({
      firebase_uid: 'student-9',
      booking_id: 'booking-0',
      amount: 20,
      type: 'booking_refund',
    });
  });

  it('does not refund a bumped booking twice', async () => {
    signInAs(LECTURER);
    supabase.queueResults(
      { data: equipment({ hourly_cost: 10 }) },
      { data: [{ id: 'booking-0', booked_by: 'student-9' }] },
      { data: [{ firebase_uid: 'student-9', role: 'student' }] },
      { data: null },
      { data: { id: 'booking-9', status: 'approved' } },
      { data: { id: 'balance-9', balance: 50 } },
      { data: { amount: -20 } },
      { data: [{ id: 'refund-1' }] }, // a refund already exists
    );

    const res = await postBooking(validBooking());

    expect(res.statusCode).toBe(201);
    expect(supabase.findCall('student_token_balances', 'update')).toBeUndefined();
    expect(supabase.findCall('token_transactions', 'insert')).toBeUndefined();
  });

  it('treats an overlap whose profile is missing as a student', async () => {
    signInAs(STUDENT);
    supabase.queueResults(
      { data: equipment() },
      { data: [{ id: 'booking-0', booked_by: 'ghost-user' }] },
      { data: [] },
    );

    const res = await postBooking(validBooking());

    expect(res.statusCode).toBe(409);
  });

  // D-14 regression: a failing overlap query must never be swallowed, or the
  // priority rules see an empty slot and wave the booking through.
  it('refuses the booking when the overlap query fails', async () => {
    signInAs(LECTURER);
    supabase.queueResults(
      { data: equipment() },
      { data: null, error: { message: 'relationship not found', code: 'PGRST200' } },
    );

    const res = await postBooking(validBooking());

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(supabase.findCall('bookings', 'insert')).toBeUndefined();
  });
});

describe('POST /api/v1/bookings — student tokens', () => {
  const paidEquipment = () => equipment({ hourly_cost: 10 });

  // TC-TOK-02
  it('deducts the right number of tokens and logs the transaction', async () => {
    signInAs(STUDENT);
    supabase.queueResults(
      { data: paidEquipment() },
      { data: [] },
      { data: { id: 'booking-4', status: 'pending' } },
      { data: { id: 'balance-1', balance: 100 } },
      { data: null },
      { data: null },
    );

    const res = await postBooking(validBooking());

    expect(res.statusCode).toBe(201);
    // 2 hours at 10 tokens/hour = 20, leaving 80.
    expect(supabase.findCall('student_token_balances', 'update')?.payload).toEqual({ balance: 80 });
    expect(supabase.findCall('token_transactions', 'insert')?.payload).toMatchObject({
      amount: -20,
      type: 'booking_deduction',
      booking_id: 'booking-4',
    });
  });

  // TC-TOK-05
  it('refuses the booking and deletes it again when the student cannot afford it', async () => {
    signInAs(STUDENT);
    supabase.queueResults(
      { data: paidEquipment() },
      { data: [] },
      { data: { id: 'booking-5', status: 'pending' } },
      { data: { id: 'balance-1', balance: 5 } },
      { data: null },
    );

    const res = await postBooking(validBooking());

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/Insufficient tokens. Need 20, have 5/);
    // The booking row must be rolled back, not left orphaned.
    expect(supabase.findCall('bookings', 'delete')).toBeDefined();
  });
});

describe('PUT /api/v1/bookings/:id/approve', () => {
  // TC-RBAC-02
  it('stops a student approving a booking', async () => {
    signInAs(STUDENT);

    const res = await app.inject({ method: 'PUT', url: '/api/v1/bookings/booking-1/approve' });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('INSUFFICIENT_ROLE');
    expect(supabase.calls).toHaveLength(0);
  });

  // TC-BOOK-17
  it('lets a tenant admin approve a pending booking in their own faculty', async () => {
    signInAs(TENANT_ADMIN);
    supabase.queueResults(
      { data: { id: 'booking-1', status: 'pending', tenant_id: 'tenant-a' } }, // tenant-ownership fetch
      { data: { id: 'booking-1', status: 'approved', tenant_id: 'tenant-a' } }, // update
    );

    const res = await app.inject({ method: 'PUT', url: '/api/v1/bookings/booking-1/approve' });

    expect(res.statusCode).toBe(200);
    expect(supabase.findCall('bookings', 'update')?.payload).toMatchObject({
      status: 'approved',
      approved_by: TENANT_ADMIN.sub,
    });
  });

  // TC-BOOK-18
  it('returns 404 when the booking is not pending', async () => {
    signInAs(TENANT_ADMIN);
    supabase.queueResults({ data: null, error: { message: 'no rows' } }); // the fetch itself finds nothing

    const res = await app.inject({ method: 'PUT', url: '/api/v1/bookings/booking-1/approve' });

    expect(res.statusCode).toBe(404);
  });

  // TC-RBAC-04 — a tenant admin must not approve another faculty's booking.
  it('stops a tenant admin approving a booking from another faculty', async () => {
    signInAs(TENANT_ADMIN);
    supabase.queueResults({ data: { id: 'booking-1', status: 'pending', tenant_id: 'tenant-b' } });

    const res = await app.inject({ method: 'PUT', url: '/api/v1/bookings/booking-1/approve' });

    expect(res.statusCode).toBe(403);
    expect(supabase.findCall('bookings', 'update')).toBeUndefined();
  });

  it('lets main_admin approve a booking from any faculty', async () => {
    signInAs({ ...TENANT_ADMIN, sub: 'super-1', appRole: 'main_admin', tenantId: null });
    supabase.queueResults(
      { data: { id: 'booking-1', status: 'pending', tenant_id: 'tenant-b' } },
      { data: { id: 'booking-1', status: 'approved', tenant_id: 'tenant-b' } },
    );

    const res = await app.inject({ method: 'PUT', url: '/api/v1/bookings/booking-1/approve' });

    expect(res.statusCode).toBe(200);
  });
});

describe('auth state', () => {
  it('is reset between tests', () => {
    expect(authState.user).toBeNull();
  });
});
