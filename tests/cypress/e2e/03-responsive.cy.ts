/**
 * Layout and responsiveness.
 * Covers TC-GUI-11 and TC-GUI-12.
 */

const PHONE: [number, number] = [390, 844];
const TABLET: [number, number] = [768, 1024];
const DESKTOP: [number, number] = [1280, 800];

describe('Responsive layout', () => {
  beforeEach(() => {
    cy.login('student');
  });

  it('TC-GUI-12 shows the sidebar on desktop', () => {
    cy.viewport(...DESKTOP);
    cy.visit('/');
    cy.get('.sidebar').should('be.visible');
  });

  it('TC-GUI-11 swaps to the bottom bar on a phone', () => {
    cy.viewport(...PHONE);
    cy.visit('/');

    cy.get('.bottom-nav').should('be.visible');
    cy.get('.sidebar').should('not.be.visible');
  });

  it('TC-GUI-11 never scrolls sideways at any width', () => {
    ([PHONE, TABLET, DESKTOP] as Array<[number, number]>).forEach(([w, h]) => {
      cy.viewport(w, h);
      cy.visit('/bookings');

      // A horizontal scrollbar on the body is the classic responsive bug.
      cy.document().then(doc => {
        const el = doc.documentElement;
        expect(el.scrollWidth, `no sideways scroll at ${w}px`).to.be.at.most(el.clientWidth + 1);
      });
    });
  });

});

// Signed out, so /login actually renders instead of redirecting away.
describe('Responsive layout, signed out', () => {
  it('keeps the login form usable on a phone', () => {
    cy.logout();
    cy.viewport(...PHONE);
    cy.visit('/login');

    cy.get('#login-email').should('be.visible');
    cy.get('#login-password').should('be.visible');
    cy.get('form.auth-form button[type="submit"]').should('be.visible');
  });
});
