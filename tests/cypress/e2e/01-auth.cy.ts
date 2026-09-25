/**
 * Authentication and route protection.
 * Covers TC-GUI-01 to TC-GUI-05, TC-GUI-09.
 */

describe('Authentication, signed out', () => {
  beforeEach(() => {
    cy.logout();
  });

  it('TC-GUI-01 sends a signed-out visitor to the login page', () => {
    cy.visit('/bookings');
    cy.location('pathname').should('eq', '/login');
    cy.get('.auth-title').should('contain.text', 'Welcome Back');
  });

  it('TC-GUI-01 protects every private route', () => {
    ['/', '/resources', '/st-resources', '/notifications', '/profile', '/admin/users'].forEach(
      path => {
        cy.visit(path);
        cy.location('pathname').should('eq', '/login');
      },
    );
  });

  it('TC-GUI-03 will not submit an empty form', () => {
    cy.visit('/login');
    cy.get('form.auth-form button[type="submit"]').click();
    // Native required validation blocks submission, so we stay put.
    cy.location('pathname').should('eq', '/login');
    cy.get('#login-email:invalid').should('exist');
  });

  it('TC-GUI-04 shows a readable error for a wrong password', () => {
    cy.credentials('student').then(({ email }) => {
      cy.attemptLogin(email, 'definitely-not-the-password');
    });

    cy.get('.toast-error', { timeout: 20000 })
      .should('be.visible')
      .and('contain.text', 'Invalid email or password');

    cy.location('pathname').should('eq', '/login');
  });

  it('TC-GUI-04 does not leak whether an account exists', () => {
    cy.attemptLogin(`no-such-user-${Date.now()}@test.local`, 'whatever123');

    cy.get('.toast-error', { timeout: 20000 }).should('be.visible');
    // Firebase distinguishes these cases; the UI must not expose raw codes.
    cy.get('.toast-error').should('not.contain.text', 'auth/');
  });

  it('TC-GUI-05 disables the submit button while signing in', () => {
    cy.credentials('student').then(({ email, password }) => {
      cy.attemptLogin(email, password);
    });

    // Guards against double submission.
    cy.get('form.auth-form button[type="submit"]').should('be.disabled');
  });

  it('reveals the password when the eye button is pressed', () => {
    cy.visit('/login');
    cy.get('#login-password').type('secret123', { log: false });
    cy.get('#login-password').should('have.attr', 'type', 'password');
    cy.get('#login-password').siblings('button[type="button"]').click();
    cy.get('#login-password').should('have.attr', 'type', 'text');
  });
});

describe('Authentication, signed in', () => {
  beforeEach(() => {
    cy.login('student');
  });

  it('lands on the dashboard after signing in', () => {
    cy.location('pathname').should('eq', '/');
    cy.get('.sidebar').should('exist');
  });

  it('TC-GUI-02 redirects a signed-in user away from the login page', () => {
    cy.visit('/login');
    cy.location('pathname').should('eq', '/');
  });

  it('TC-GUI-09 sends an unknown URL back to the dashboard', () => {
    cy.visit('/this-route-does-not-exist');
    cy.location('pathname').should('eq', '/');
  });
});
