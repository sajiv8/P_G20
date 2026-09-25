/**
 * Role-based navigation — what each role is allowed to see.
 * Covers TC-GUI-10 and the UI half of the RBAC matrix.
 */

describe('Navigation and role visibility', () => {
  describe('as a student', () => {
    beforeEach(() => {
      cy.login('student');
      cy.visit('/');
    });

    it('TC-GUI-10 hides the admin-only links', () => {
      cy.get('.sidebar').should('be.visible');
      cy.get('.sidebar .nav-label').should('contain.text', 'Dashboard');

      // Admin section must not be rendered at all for a student.
      cy.get('.sidebar').should('not.contain.text', 'Users');
      cy.get('.sidebar').should('not.contain.text', 'Tenants');
    });

    it('shows every link a student is entitled to', () => {
      ['Dashboard', 'Resources', 'ST Resource', 'ST Borrows', 'Bookings', 'Notifications', 'Profile']
        .forEach(label => {
          cy.get('.sidebar .nav-label').contains(label).should('be.visible');
        });
    });

    it('navigates to each page without an error', () => {
      const routes: Array<[string, string]> = [
        ['Resources', '/resources'],
        ['Bookings', '/bookings'],
        ['Notifications', '/notifications'],
        ['Profile', '/profile'],
      ];

      routes.forEach(([label, path]) => {
        cy.get('.sidebar .nav-label').contains(label).click();
        cy.location('pathname').should('eq', path);
        cy.get('.toast-error').should('not.exist');
      });
    });

    it('marks the current page as active in the sidebar', () => {
      cy.get('.sidebar .nav-label').contains('Bookings').click();
      cy.get('.sidebar .nav-item.active').should('contain.text', 'Bookings');
    });

    it('still blocks the admin page when the URL is typed directly', () => {
      cy.visit('/admin/users');
      // The route renders, so the API must be what refuses — no admin data shown.
      cy.get('body').should('not.contain.text', 'Register User');
    });
  });

  describe('as an admin', () => {
    beforeEach(() => {
      cy.login('admin');
      cy.visit('/');
    });

    it('shows the admin section', () => {
      cy.get('.sidebar').should('contain.text', 'Users');
    });

    it('opens the user management page', () => {
      cy.get('.sidebar .nav-label').contains('Users').click();
      cy.location('pathname').should('eq', '/admin/users');
      cy.get('.toast-error').should('not.exist');
    });
  });
});
