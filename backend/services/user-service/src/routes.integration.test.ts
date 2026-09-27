/**
 * Integration tests for the user service routes.
 *
 * These drive the real Fastify app through `inject()`, so routing, the RBAC
 * guard, the shared error handler and the route logic all run for real. Only
 * the outside systems are faked: Supabase, Redis and Firebase.
 *
 * This service holds signup, password reset, role changes and banning — the
 * most security-sensitive code in the project — and had no tests before this.
 */

import type { FastifyInstance } from 'fastify';
import { getSupabaseClient, getRedisClient, publishEvent } from '@rso/shared';
import { setUserClaims, updateUserRole } from './firebase-claims';
import { buildServer } from './server';
import { createSupabaseMock } from './test-helpers/supabase-mock';
import { createRedisMock } from './test-helpers/redis-mock';
import { authState, signInAs, signOut, TestUser } from './test-helpers/auth-state';

// ---------------------------------------------------------------------------
// Firebase: the real modules read a service-account file and call Google.
// ---------------------------------------------------------------------------
const firebaseAuth = {
  createUser: jest.fn(),
  deleteUser: jest.fn().mockResolvedValue(undefined),
  updateUser: jest.fn().mockResolvedValue(undefined),
  getUser: jest.fn().mockResolvedValue({ customClaims: {} }),
  setCustomUserClaims: jest.fn().mockResolvedValue(undefined),
  revokeRefreshTokens: jest.fn().mockResolvedValue(undefined),
  generateEmailVerificationLink: jest.fn().mockResolvedValue('https://verify.example/link'),
  generatePasswordResetLink: jest.fn().mockResolvedValue('https://reset.example/link'),
};

jest.mock('firebase-admin/auth', () => ({
  getAuth: () => firebaseAuth,
}));

jest.mock('./firebase-admin', () => ({
  initFirebaseAdmin: jest.fn(),
}));

jest.mock('./firebase-claims', () => ({
  setUserClaims: jest.fn().mockResolvedValue(undefined),
  updateUserRole: jest.fn().mockResolvedValue(undefined),
  clearUserClaims: jest.fn().mockResolvedValue(undefined),
  getUserClaims: jest.fn().mockResolvedValue({}),
}));

jest.mock('@rso/shared', () => {
  const actual = jest.requireActual('@rso/shared');
  const { authState: state } = jest.requireActual('./test-helpers/auth-state');

  return {
    ...actual,
    getSupabaseClient: jest.fn(),
    getRedisClient: jest.fn(),
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
    // Real: ApiError, errorHandler, requireRole, sendSuccess, sendPaginated.
  };
});

const supabase = createSupabaseMock();
const redis = createRedisMock();

const STUDENT: TestUser = { sub: 'student-1', email: 's1@test.local', tenantId: 'tenant-a', appRole: 'student' };
const OTHER_STUDENT: TestUser = { sub: 'student-2', email: 's2@test.local', tenantId: 'tenant-a', appRole: 'student' };
const TENANT_ADMIN: TestUser = { sub: 'admin-a', email: 'a@test.local', tenantId: 'tenant-a', appRole: 'tenant_admin' };
const MAIN_ADMIN: TestUser = { sub: 'super-1', email: 'root@test.local', tenantId: null, appRole: 'main_admin' };

const activeTenant = { id: 'tenant-a', name: 'Faculty of Computing', is_active: true };

let app: FastifyInstance;

beforeEach(() => {
  supabase.reset();
  redis.reset();
  signOut();
  jest.clearAllMocks();
  (getSupabaseClient as jest.Mock).mockReturnValue(supabase.client);
  (getRedisClient as jest.Mock).mockReturnValue(redis.client);
  (publishEvent as jest.Mock).mockResolvedValue(undefined);
  firebaseAuth.generatePasswordResetLink.mockResolvedValue('https://reset.example/link');
  firebaseAuth.generateEmailVerificationLink.mockResolvedValue('https://verify.example/link');
  firebaseAuth.getUser.mockResolvedValue({ customClaims: {} });
  app = buildServer();
});

afterEach(async () => {
  await app.close();
});

// ===========================================================================
describe('GET /health', () => {
  it('reports the service as ok without authentication', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', service: 'user-service' });
  });
});

// ===========================================================================
describe('POST /api/v1/users/signup', () => {
  const signup = (payload: Record<string, unknown>) =>
    app.inject({ method: 'POST', url: '/api/v1/users/signup', payload });

  // TC-AUTH-14
  it('rejects an unauthenticated request', async () => {
    const res = await signup({ tenant_code: 'FOC' });

    expect(res.statusCode).toBe(401);
    expect(supabase.calls).toHaveLength(0);
  });

  it('requires a faculty code', async () => {
    signInAs(STUDENT);

    const res = await signup({});

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/tenant_code is required/i);
    expect(supabase.calls).toHaveLength(0);
  });

  // TC-AUTH-01 / TC-TOK-01
  it('creates the profile, grants 100 tokens and sets claims', async () => {
    signInAs(STUDENT);
    supabase.queueResults(
      { data: activeTenant },                                  // tenant lookup
      { data: null },                                          // no existing profile
      { data: { firebase_uid: 'student-1', role: 'student' } }, // profile insert
      { data: null },                                          // token balance insert
      { data: null },                                          // transaction insert
    );

    const res = await signup({ tenant_code: 'FOC', full_name: 'Test Student' });

    expect(res.statusCode).toBe(201);

    // Always a student on self-signup, never a role chosen by the caller.
    expect(supabase.findCall('user_profiles', 'insert')?.payload).toMatchObject({
      firebase_uid: 'student-1',
      tenant_id: 'tenant-a',
      role: 'student',
    });

    expect(supabase.findCall('student_token_balances', 'insert')?.payload).toMatchObject({
      firebase_uid: 'student-1',
      balance: 100,
      monthly_quota: 100,
    });

    // The grant is recorded, not just applied.
    expect(supabase.findCall('token_transactions', 'insert')?.payload).toMatchObject({
      firebase_uid: 'student-1',
      amount: 100,
    });

    expect(setUserClaims).toHaveBeenCalledWith('student-1', 'tenant-a', 'student');
  });

  it('cannot be tricked into signing up as an admin', async () => {
    signInAs(STUDENT);
    supabase.queueResults(
      { data: activeTenant },
      { data: null },
      { data: { firebase_uid: 'student-1', role: 'student' } },
      { data: null },
      { data: null },
    );

    // A caller-supplied role must be ignored entirely.
    await signup({ tenant_code: 'FOC', role: 'main_admin', full_name: 'Sneaky' });

    expect(supabase.findCall('user_profiles', 'insert')?.payload).toMatchObject({ role: 'student' });
    expect(setUserClaims).toHaveBeenCalledWith('student-1', 'tenant-a', 'student');
  });

  // TC-AUTH-02
  it('rejects a faculty code that does not exist', async () => {
    signInAs(STUDENT);
    supabase.queueResults({ data: null, error: { message: 'no rows' } });

    const res = await signup({ tenant_code: 'NOPE' });

    expect(res.statusCode).toBe(404);
    expect(supabase.findCall('user_profiles', 'insert')).toBeUndefined();
  });

  // TC-AUTH-03
  it('rejects an inactive faculty', async () => {
    signInAs(STUDENT);
    supabase.queueResults({ data: { ...activeTenant, is_active: false } });

    const res = await signup({ tenant_code: 'FOC' });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/inactive/i);
    expect(supabase.findCall('user_profiles', 'insert')).toBeUndefined();
  });

  // TC-AUTH-04
  it('refuses a second signup for the same account', async () => {
    signInAs(STUDENT);
    supabase.queueResults(
      { data: activeTenant },
      { data: { firebase_uid: 'student-1' } }, // already has a profile
    );

    const res = await signup({ tenant_code: 'FOC' });

    expect(res.statusCode).toBe(409);
    // Critically, no second token grant.
    expect(supabase.findCall('student_token_balances', 'insert')).toBeUndefined();
  });

  it('still succeeds when the notification event fails', async () => {
    signInAs(STUDENT);
    (publishEvent as jest.Mock).mockRejectedValue(new Error('redis down'));
    supabase.queueResults(
      { data: activeTenant },
      { data: null },
      { data: { firebase_uid: 'student-1', role: 'student' } },
      { data: null },
      { data: null },
    );

    const res = await signup({ tenant_code: 'FOC' });

    // A lost welcome email must not cost the user their account.
    expect(res.statusCode).toBe(201);
  });
});

// ===========================================================================
describe('POST /api/v1/users/forgot-password', () => {
  const forgot = (payload: Record<string, unknown>) =>
    app.inject({ method: 'POST', url: '/api/v1/users/forgot-password', payload });

  it('requires a valid email and a member id', async () => {
    const noEmail = await forgot({ email: 'nonsense', member_id: 'X' });
    expect(noEmail.statusCode).toBe(400);

    const noId = await forgot({ email: 'a@b.c', member_id: '  ' });
    expect(noId.statusCode).toBe(400);
  });

  // TC-AUTH-11 — the response must not reveal whether the account exists.
  it('gives the same answer for an unknown email and a wrong member id', async () => {
    supabase.queueResults({ data: null }); // no such profile
    const unknown = await forgot({ email: 'nobody@test.local', member_id: '12345' });

    supabase.reset();
    supabase.queueResults({ data: { firebase_uid: 'u1', email: 'real@test.local', member_id: 'REAL123' } });
    const wrongId = await forgot({ email: 'real@test.local', member_id: 'WRONG' });

    expect(unknown.statusCode).toBe(wrongId.statusCode);
    expect(unknown.json().error.message).toBe(wrongId.json().error.message);
    // Neither answer may hint that one of the two accounts is real.
    expect(unknown.json().error.message).not.toMatch(/not found|no such|unknown email/i);
  });

  it('matches the member id case-insensitively and sends a reset link', async () => {
    supabase.queueResults({
      data: { firebase_uid: 'u1', email: 'real@test.local', full_name: 'Real', member_id: 'ABC123' },
    });

    const res = await forgot({ email: 'real@test.local', member_id: 'abc123' });

    expect(res.statusCode).toBe(200);
    expect(firebaseAuth.generatePasswordResetLink).toHaveBeenCalledWith('real@test.local');
    expect(publishEvent).toHaveBeenCalled();
  });

  it('does not leak the reset link in the response body', async () => {
    supabase.queueResults({
      data: { firebase_uid: 'u1', email: 'real@test.local', member_id: 'ABC123' },
    });

    const res = await forgot({ email: 'real@test.local', member_id: 'ABC123' });

    // The link is the credential. It belongs in the email, nowhere else.
    expect(res.payload).not.toMatch(/reset\.example/);
  });
});

// ===========================================================================
describe('POST /api/v1/users/reset-password', () => {
  const reset = (payload: Record<string, unknown>) =>
    app.inject({ method: 'POST', url: '/api/v1/users/reset-password', payload });

  const seedCode = (email: string, otp: string, uid = 'u1') =>
    redis.seed(`pwd-reset:${email}`, JSON.stringify({ otp, uid }));

  it('requires all three fields', async () => {
    const res = await reset({ email: 'a@b.c', code: '123456' });
    expect(res.statusCode).toBe(400);
  });

  // TC-AUTH-13
  it('rejects a password shorter than six characters', async () => {
    const res = await reset({ email: 'a@b.c', code: '123456', new_password: 'abc' });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/six|6 characters/i);
    expect(firebaseAuth.updateUser).not.toHaveBeenCalled();
  });

  it('rejects a code that was never issued or has expired', async () => {
    const res = await reset({ email: 'a@b.c', code: '123456', new_password: 'longenough' });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/expired/i);
    expect(firebaseAuth.updateUser).not.toHaveBeenCalled();
  });

  // TC-AUTH-12
  it('sets the new password and consumes the code', async () => {
    seedCode('a@b.c', '123456', 'uid-42');

    const res = await reset({ email: 'a@b.c', code: '123456', new_password: 'newpassword' });

    expect(res.statusCode).toBe(200);
    expect(firebaseAuth.updateUser).toHaveBeenCalledWith('uid-42', { password: 'newpassword' });
    // Single use: the code must not survive to be replayed.
    expect(redis.has('pwd-reset:a@b.c')).toBe(false);
  });

  it('tolerates whitespace around the code', async () => {
    seedCode('a@b.c', '123456');

    const res = await reset({ email: 'a@b.c', code: '  123456  ', new_password: 'newpassword' });

    expect(res.statusCode).toBe(200);
  });

  it('rejects a wrong code and counts down the remaining attempts', async () => {
    seedCode('a@b.c', '123456');

    const res = await reset({ email: 'a@b.c', code: '000000', new_password: 'newpassword' });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/4 attempts remaining/);
    expect(firebaseAuth.updateUser).not.toHaveBeenCalled();
  });

  // TC-AUTH-09 / D-03 regression — a six-digit code must not be brute-forceable.
  it('burns the code after five wrong guesses', async () => {
    seedCode('a@b.c', '123456');

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const res = await reset({ email: 'a@b.c', code: '000000', new_password: 'newpassword' });
      expect(res.statusCode).toBe(400);
    }

    const sixth = await reset({ email: 'a@b.c', code: '000000', new_password: 'newpassword' });

    expect(sixth.statusCode).toBe(429);
    expect(sixth.json().error.message).toMatch(/too many/i);
    // And the code is gone, so the attacker cannot keep working against it.
    expect(redis.has('pwd-reset:a@b.c')).toBe(false);
  });

  it('will not accept the right code once the allowance is spent', async () => {
    seedCode('a@b.c', '123456');

    for (let attempt = 1; attempt <= 6; attempt += 1) {
      await reset({ email: 'a@b.c', code: '000000', new_password: 'newpassword' });
    }

    const withCorrectCode = await reset({ email: 'a@b.c', code: '123456', new_password: 'newpassword' });

    expect(withCorrectCode.statusCode).toBe(400); // code no longer exists
    expect(firebaseAuth.updateUser).not.toHaveBeenCalled();
  });
});

// ===========================================================================
describe('role changes — PUT /api/v1/users/:uid/role', () => {
  const changeRole = (uid: string, payload: Record<string, unknown>) =>
    app.inject({ method: 'PUT', url: `/api/v1/users/${uid}/role`, payload });

  // TC-SEC-02
  it('refuses a student outright', async () => {
    signInAs(STUDENT);

    const res = await changeRole('student-2', { role: 'lecturer' });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('INSUFFICIENT_ROLE');
    expect(supabase.calls).toHaveLength(0);
  });

  // TC-RBAC-03
  it('stops a tenant admin creating a main admin', async () => {
    signInAs(TENANT_ADMIN);

    const res = await changeRole('student-2', { role: 'main_admin' });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.message).toMatch(/only main_admin/i);
    expect(supabase.findCall('user_profiles', 'update')).toBeUndefined();
  });

  it('rejects a role that is not in the allowed set', async () => {
    signInAs(MAIN_ADMIN);

    const res = await changeRole('student-2', { role: 'wizard' });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/invalid role/i);
  });

  // TC-RBAC-04
  it('stops a tenant admin changing a role in another faculty', async () => {
    signInAs(TENANT_ADMIN);
    supabase.queueResults({ data: { tenant_id: 'tenant-b' } }); // target is elsewhere

    const res = await changeRole('student-9', { role: 'lecturer' });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.message).toMatch(/outside your faculty/i);
    expect(supabase.findCall('user_profiles', 'update')).toBeUndefined();
  });

  it('stops a tenant admin moving a user into another faculty', async () => {
    signInAs(TENANT_ADMIN);
    supabase.queueResults({ data: { tenant_id: 'tenant-a' } });

    const res = await changeRole('student-2', { role: 'lecturer', tenant_id: 'tenant-b' });

    expect(res.statusCode).toBe(403);
    expect(supabase.findCall('user_profiles', 'update')).toBeUndefined();
  });

  // TC-RBAC-14
  it('updates the role and syncs the Firebase claim', async () => {
    signInAs(TENANT_ADMIN);
    supabase.queueResults(
      { data: { tenant_id: 'tenant-a' } },
      { data: { firebase_uid: 'student-2', role: 'lecturer', tenant_id: 'tenant-a', email: 's2@test.local' } },
    );

    const res = await changeRole('student-2', { role: 'lecturer' });

    expect(res.statusCode).toBe(200);
    expect(supabase.findCall('user_profiles', 'update')?.payload).toMatchObject({ role: 'lecturer' });
    // Without this the database and the token disagree about who the user is.
    expect(updateUserRole).toHaveBeenCalledWith('student-2', 'lecturer');
  });
});

// ===========================================================================
describe('banning — PUT /api/v1/users/:uid/ban', () => {
  const ban = (uid: string) =>
    app.inject({ method: 'PUT', url: `/api/v1/users/${uid}/ban`, payload: { reason: 'spam' } });

  // TC-RBAC-05
  it('is closed to tenant admins', async () => {
    signInAs(TENANT_ADMIN);

    const res = await ban('student-2');

    expect(res.statusCode).toBe(403);
    expect(supabase.calls).toHaveLength(0);
  });

  // TC-RBAC-06
  it('will not let a main admin ban themselves', async () => {
    signInAs(MAIN_ADMIN);

    const res = await ban(MAIN_ADMIN.sub);

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/cannot ban yourself/i);
  });

  // TC-RBAC-07
  it('will not let one main admin ban another', async () => {
    signInAs(MAIN_ADMIN);
    supabase.queueResults({ data: { role: 'main_admin', full_name: 'The Other Root' } });

    const res = await ban('super-2');

    expect(res.statusCode).toBe(403);
    expect(res.json().error.message).toMatch(/another main admin/i);
    expect(firebaseAuth.setCustomUserClaims).not.toHaveBeenCalled();
  });

  // TC-AUTH-16
  it('deactivates the account, flags the token and revokes refresh tokens', async () => {
    signInAs(MAIN_ADMIN);
    supabase.queueResults(
      { data: { role: 'student', full_name: 'Naughty Student' } }, // target lookup
      { data: null },                                              // is_active update
      { data: { email: 's2@test.local', tenant_id: 'tenant-a' } }, // profile for the event
    );

    const res = await ban('student-2');

    expect(res.statusCode).toBe(200);
    expect(supabase.findCall('user_profiles', 'update')?.payload).toMatchObject({ is_active: false });

    // The claim is what actually locks them out of the API.
    expect(firebaseAuth.setCustomUserClaims).toHaveBeenCalledWith(
      'student-2',
      expect.objectContaining({ is_banned: true }),
    );
    // Without this they keep working until their current token expires.
    expect(firebaseAuth.revokeRefreshTokens).toHaveBeenCalledWith('student-2');
  });
});

// ===========================================================================
describe('profile access — GET and PUT /api/v1/users/:uid', () => {
  // TC-RBAC-11 / TC-SEC-01 — the classic IDOR.
  it('stops a student reading another student’s profile', async () => {
    signInAs(STUDENT);
    supabase.queueResults({ data: { firebase_uid: 'student-2', tenant_id: 'tenant-a' } });

    const res = await app.inject({ method: 'GET', url: '/api/v1/users/student-2' });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.message).toMatch(/own faculty/i);
  });

  it('lets a user read their own profile', async () => {
    signInAs(STUDENT);
    supabase.queueResults({ data: { firebase_uid: 'student-1', tenant_id: 'tenant-a' } });

    const res = await app.inject({ method: 'GET', url: `/api/v1/users/${STUDENT.sub}` });

    expect(res.statusCode).toBe(200);
  });

  // TC-RBAC-12
  it('strips a role a user tries to give themselves', async () => {
    signInAs(STUDENT);
    supabase.queueResults({ data: { firebase_uid: 'student-1', role: 'student' } });

    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${STUDENT.sub}`,
      payload: { full_name: 'New Name', role: 'main_admin' },
    });

    expect(res.statusCode).toBe(200);
    const payload = supabase.findCall('user_profiles', 'update')?.payload as Record<string, unknown>;
    expect(payload.full_name).toBe('New Name');
    expect(payload).not.toHaveProperty('role');
  });

  // TC-SEC-04
  it('strips an attempt to move yourself to another faculty', async () => {
    signInAs(STUDENT);
    supabase.queueResults({ data: { firebase_uid: 'student-1' } });

    await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${STUDENT.sub}`,
      payload: { full_name: 'Name', tenant_id: 'tenant-b', firebase_uid: 'someone-else' },
    });

    const payload = supabase.findCall('user_profiles', 'update')?.payload as Record<string, unknown>;
    expect(payload).not.toHaveProperty('tenant_id');
    expect(payload).not.toHaveProperty('firebase_uid');
  });

  it('stops one student updating another', async () => {
    signInAs(STUDENT);

    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${OTHER_STUDENT.sub}`,
      payload: { full_name: 'Hijacked' },
    });

    expect(res.statusCode).toBe(403);
    expect(supabase.findCall('user_profiles', 'update')).toBeUndefined();
  });
});

// ===========================================================================
describe('token administration', () => {
  // TC-SEC-02
  it('keeps the user list away from students', async () => {
    signInAs(STUDENT);

    const res = await app.inject({ method: 'GET', url: '/api/v1/users' });

    expect(res.statusCode).toBe(403);
    expect(supabase.calls).toHaveLength(0);
  });

  // TC-TOK-10
  it('scopes a bulk quota change to the admin’s own faculty', async () => {
    signInAs(TENANT_ADMIN);
    supabase.queueResults({ data: [{ id: 'b1' }], count: 1 });

    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/users/tokens/bulk',
      payload: { monthly_quota: 150 },
    });

    expect(res.statusCode).toBe(200);
    expect(supabase.findCall('student_token_balances', 'update')?.payload)
      .toMatchObject({ monthly_quota: 150 });
  });

  // TC-TOK-12
  it('rejects a negative quota', async () => {
    signInAs(TENANT_ADMIN);

    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/users/tokens/bulk',
      payload: { monthly_quota: -50 },
    });

    expect(res.statusCode).toBe(400);
    expect(supabase.findCall('student_token_balances', 'update')).toBeUndefined();
  });

  // TC-TOK-11
  it('records an admin balance adjustment as a transaction', async () => {
    signInAs(TENANT_ADMIN);
    supabase.queueResults(
      { data: { firebase_uid: 'student-1', balance: 250, monthly_quota: 100 } },
      { data: null },
    );

    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/users/student-1/tokens',
      payload: { balance: 250 },
    });

    expect(res.statusCode).toBe(200);
    // An adjustment with no audit trail is indistinguishable from tampering.
    expect(supabase.findCall('token_transactions', 'insert')?.payload).toMatchObject({
      firebase_uid: 'student-1',
      type: 'admin_adjustment',
    });
  });

  it('requires something to actually change', async () => {
    signInAs(TENANT_ADMIN);

    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/users/student-1/tokens',
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });
});

// ===========================================================================
describe('test isolation', () => {
  it('signs out between tests', () => {
    expect(authState.user).toBeNull();
  });
});
