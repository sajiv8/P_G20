/// <reference types="cypress" />

export type TestRole = 'student' | 'admin';

export interface TestCredentials {
  email: string;
  password: string;
}

declare global {
  namespace Cypress {
    interface Chainable {
      /** Yields the credentials for a role from cypress.env.json. */
      credentials(role?: TestRole): Chainable<TestCredentials>;
      /** Sign in through the real login form and wait for the app shell. */
      login(role?: TestRole): Chainable<void>;
      /** Clear every trace of a Firebase session, including IndexedDB. */
      logout(): Chainable<void>;
      /** Fill and submit the login form, without asserting the outcome. */
      attemptLogin(email: string, password: string): Chainable<void>;
    }
  }
}

// Credentials are sensitive, so they come from `env` via cy.env() rather than
// the `expose` config, which is readable from the application under test.
Cypress.Commands.add('credentials', (role: TestRole = 'student') => {
  const emailKey = role === 'admin' ? 'adminEmail' : 'studentEmail';
  const passwordKey = role === 'admin' ? 'adminPassword' : 'studentPassword';

  return cy.env([emailKey, passwordKey]).then(vars => {
    const email = vars[emailKey];
    const password = vars[passwordKey];

    if (!email || !password) {
      throw new Error(
        `Missing ${role} credentials. Copy cypress.env.example.json to cypress.env.json and fill it in.`,
      );
    }
    return { email, password } as TestCredentials;
  });
});

Cypress.Commands.add('attemptLogin', (email: string, password: string) => {
  cy.visit('/login');
  cy.get('#login-email').clear().type(email);
  cy.get('#login-password').clear().type(password, { log: false });
  cy.get('form.auth-form button[type="submit"]').click();
});

// Firebase keeps its session in IndexedDB, which Cypress does not clear
// between tests and cy.session cannot cache. So sessions are not reused:
// each login starts from a clean slate, which is slower but deterministic.
Cypress.Commands.add('logout', () => {
  cy.visit('/'); // a window must exist before IndexedDB is reachable
  cy.clearAllCookies();
  cy.clearAllLocalStorage();
  cy.clearAllSessionStorage();

  cy.window({ log: false }).then(
    win =>
      new Cypress.Promise<void>(resolve => {
        const request = win.indexedDB.deleteDatabase('firebaseLocalStorageDb');
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
        request.onblocked = () => resolve();
      }),
  );
});

Cypress.Commands.add('login', (role: TestRole = 'student') => {
  cy.credentials(role).then(({ email, password }) => {
    cy.logout();
    cy.attemptLogin(email, password);
    cy.get('.sidebar', { timeout: 20000 }).should('exist');
  });
});

export {};
