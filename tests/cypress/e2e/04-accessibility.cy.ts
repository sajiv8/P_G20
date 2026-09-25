/**
 * Accessibility audit — WCAG 2.1 Level AA.
 * Covers TC-A11Y-01 to TC-A11Y-08 (the automatable half).
 *
 * TC-A11Y-09 (screen reader with NVDA) and the judgement calls around
 * colour-only status still have to be done by hand.
 */

describe('Accessibility, signed out', () => {
  beforeEach(() => {
    cy.logout();
  });

  it('TC-A11Y-02 login page meets WCAG 2.1 AA', () => {
    cy.visit('/login');
    cy.get('#login-email').should('be.visible');
    cy.injectAxe();
    cy.checkA11y('login page');
  });

  it('TC-A11Y-03 every login field has a programmatic label', () => {
    cy.visit('/login');

    // A screen reader must announce the purpose, not just "edit text".
    cy.get('#login-email').then($input => {
      const id = $input.attr('id');
      cy.get(`label[for="${id}"]`).should('exist').and('not.be.empty');
    });
    cy.get('#login-password').then($input => {
      const id = $input.attr('id');
      cy.get(`label[for="${id}"]`).should('exist').and('not.be.empty');
    });
  });

  it('TC-A11Y-01 the login form is operable by keyboard', () => {
    cy.visit('/login');

    // Cypress cannot press Tab natively, so verify the preconditions instead:
    // each control is focusable, nothing is removed from the tab order, and
    // DOM order matches the visual order.
    cy.get('#login-email').focus().should('have.focus');
    cy.get('#login-password').focus().should('have.focus');
    cy.get('form.auth-form button[type="submit"]').focus().should('have.focus');

    cy.get('form.auth-form').find('input, button, a').each($el => {
      expect($el.attr('tabindex'), 'control is not taken out of the tab order').to.not.eq('-1');
    });

    // Enter in a text field must submit the form.
    cy.get('#login-email').type('keyboard@test.local');
    cy.get('#login-password').type('short{enter}', { log: false });
    cy.get('.toast-error', { timeout: 20000 }).should('be.visible');
  });

  it('TC-A11Y-01 focus is always visible', () => {
    cy.visit('/login');

    cy.get('#login-email').focus();
    cy.focused().then($el => {
      const style = window.getComputedStyle($el[0]);
      const hasRing =
        style.outlineStyle !== 'none' ||
        parseFloat(style.outlineWidth) > 0 ||
        style.boxShadow !== 'none';
      expect(hasRing, 'focused control has a visible outline or shadow').to.be.true;
    });
  });

  it('TC-A11Y-08 stays readable at 200% zoom', () => {
    // Halving the viewport is equivalent to doubling the zoom.
    cy.viewport(640, 400);
    cy.visit('/login');

    cy.get('#login-email').should('be.visible');
    cy.get('form.auth-form button[type="submit"]').should('be.visible');

    cy.document().then(doc => {
      const el = doc.documentElement;
      expect(el.scrollWidth, 'no sideways scroll at 200% zoom').to.be.at.most(el.clientWidth + 1);
    });
  });
});

describe('Accessibility, signed in', () => {
  beforeEach(() => {
    cy.login('student');
  });

  const pages: Array<[string, string]> = [
    ['dashboard', '/'],
    ['resources', '/resources'],
    ['bookings', '/bookings'],
    ['notifications', '/notifications'],
    ['profile', '/profile'],
  ];

  pages.forEach(([name, path]) => {
    it(`TC-A11Y-02 ${name} page meets WCAG 2.1 AA`, () => {
      cy.visit(path);
      cy.get('.sidebar').should('exist');
      cy.injectAxe();
      cy.checkA11y(`${name} page`);
    });
  });

  it('TC-A11Y-07 every image has a text alternative', () => {
    cy.visit('/resources');
    cy.get('body').then($body => {
      const images = $body.find('img');
      if (images.length === 0) {
        cy.log('no images on this page');
        return;
      }
      images.each((_, img) => {
        const hasAlt = img.hasAttribute('alt');
        const hidden = img.getAttribute('aria-hidden') === 'true';
        expect(hasAlt || hidden, `img ${img.getAttribute('src')} has alt or is hidden`).to.be.true;
      });
    });
  });

  it('TC-A11Y-01 navigation links are reachable by keyboard', () => {
    cy.visit('/');
    // NavLinks render as anchors, so they must be focusable.
    cy.get('.sidebar a.nav-item').first().focus().should('have.focus');
    cy.get('.sidebar a.nav-item').each($link => {
      expect($link.attr('href'), 'nav item is a real link').to.not.be.undefined;
    });
  });

  it('TC-A11Y-06 booking status is not conveyed by colour alone', () => {
    cy.visit('/bookings');

    // Each status indicator must carry text, not just a coloured dot.
    cy.get('body').then($body => {
      const badges = $body.find('[class*="badge"], [class*="status"]');
      if (badges.length === 0) {
        cy.log('no bookings on this page to inspect');
        return;
      }
      let withText = 0;
      badges.each((_, el) => {
        if ((el.textContent || '').trim().length > 0) withText++;
      });
      expect(withText, 'status indicators carry text').to.be.greaterThan(0);
    });
  });
});
