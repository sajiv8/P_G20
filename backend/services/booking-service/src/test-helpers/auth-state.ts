/**
 * Holds the user that the mocked auth middleware attaches to a request.
 *
 * Lives in its own module so the jest.mock factory can require it without
 * closing over a test-file variable.
 */

export interface TestUser {
  sub: string;
  email?: string;
  tenantId: string | null;
  appRole: string;
}

export const authState: { user: TestUser | null } = { user: null };

export function signInAs(user: TestUser): void {
  authState.user = user;
}

export function signOut(): void {
  authState.user = null;
}
