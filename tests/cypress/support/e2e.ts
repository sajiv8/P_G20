import './commands';
import './a11y';

// Deliberately no global storage clearing here. Cypress already isolates
// cookies and localStorage between tests, and cy.session restores them. Wiping
// Firebase's IndexedDB in a beforeEach invalidates the cached session, forcing
// a full re-login on every single test.

// The app logs benign errors (aborted fetches on unmount, Firebase token
// refreshes). Only fail a test on errors we actually care about.
Cypress.on('uncaught:exception', err => {
  if (/ResizeObserver|Network Error|Failed to fetch/i.test(err.message)) return false;
  return true;
});
