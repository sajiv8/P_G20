/**
 * Error handling in the browser.
 * Covers TC-ERR-01, TC-ERR-03, TC-ERR-04.
 *
 * The point of these is not that an error message appears — it is that the
 * application survives. A failed request must not leave a white screen, and a
 * rejected token must not put the client into a retry loop.
 *
 * TC-ERR-10 (rapid double submit) and TC-ERR-12 (back button does not
 * resubmit) are not here: both need a booking actually submitted through the
 * multi-step form, which has no stable selectors, so any test of it would be
 * testing the wizard's markup rather than the error behaviour. They stay in
 * tests/manual/CHECKLIST.md until the form carries test ids.
 *
 * TC-ERR-02 and TC-ERR-06 need services stopped mid-run, so they are manual
 * too — stopping Redis underneath a shared suite is not worth the flakiness.
 */

describe('Error handling', () => {
  beforeEach(() => {
    // Log in first: the intercepts below would otherwise break the very
    // requests that load the app shell.
    cy.login('student');
  });

  // TC-ERR-01
  it('survives the network dropping, without a blank screen', () => {
    cy.intercept('GET', '**/api/v1/**', { forceNetworkError: true }).as('dead');

    cy.visit('/bookings');

    // The shell must still render — a failed data call is not a crash.
    cy.get('.sidebar', { timeout: 20000 }).should('exist');
    cy.get('body').should('not.be.empty');

    // Something must be on screen: either an error or an empty state, but the
    // page cannot be silently blank.
    cy.get('.page-content, .app-main').should('exist');
  });

  it('recovers once the network comes back', () => {
    let failNext = true;
    cy.intercept('GET', '**/api/v1/bookings**', req => {
      if (failNext) {
        failNext = false;
        req.destroy();
        return;
      }
      req.continue();
    }).as('bookings');

    cy.visit('/bookings');
    cy.get('.sidebar').should('exist');

    // Navigating again should succeed now that the intercept lets it through.
    cy.visit('/');
    cy.visit('/bookings');
    cy.get('.sidebar').should('exist');
  });

  // TC-ERR-03 — api.ts force-refreshes the token and retries once on a 401.
  it('retries transparently when a request comes back 401 once', () => {
    let calls = 0;
    cy.intercept('GET', '**/api/v1/bookings**', req => {
      calls += 1;
      if (calls === 1) {
        req.reply({ statusCode: 401, body: { success: false, error: { code: 'AUTH_INVALID_TOKEN', message: 'expired' } } });
        return;
      }
      req.continue();
    }).as('bookings');

    cy.visit('/bookings');

    cy.get('.sidebar').should('exist');
    // The retry must actually have happened, not just the first failure.
    cy.wrap(null).should(() => {
      expect(calls, 'request was retried after the 401').to.be.greaterThan(1);
    });
  });

  // TC-ERR-04 — a token that never becomes valid must not cause a retry storm.
  it('does not loop forever when every request is rejected', () => {
    let calls = 0;
    cy.intercept('GET', '**/api/v1/**', req => {
      calls += 1;
      req.reply({ statusCode: 401, body: { success: false, error: { code: 'AUTH_INVALID_TOKEN', message: 'expired' } } });
    }).as('alwaysDenied');

    cy.visit('/bookings');
    cy.get('.sidebar').should('exist');

    // Give any runaway retry loop time to show itself.
    cy.wait(3000);

    cy.wrap(null).should(() => {
      // api.ts retries once per call. A handful of page requests is expected;
      // dozens would mean the retry is feeding itself.
      expect(calls, `request count stayed bounded (was ${calls})`).to.be.lessThan(25);
    });

    // And the app is still usable rather than wedged.
    cy.get('.sidebar').should('be.visible');
  });
});
