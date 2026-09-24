import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    // The app is served through the Nginx gateway, so GUI tests exercise the
    // same routing and rate limiting as production.
    baseUrl: process.env.CYPRESS_BASE_URL || 'http://localhost',
    specPattern: 'tests/cypress/e2e/**/*.cy.ts',
    supportFile: 'tests/cypress/support/e2e.ts',
    fixturesFolder: 'tests/cypress/fixtures',
    screenshotsFolder: 'tests/cypress/screenshots',
    videosFolder: 'tests/cypress/videos',
    video: false,
    viewportWidth: 1280,
    viewportHeight: 800,
    defaultCommandTimeout: 10000,
    retries: { runMode: 1, openMode: 0 },
    setupNodeEvents(on) {
      // Lets the accessibility spec print its findings into the run output.
      on('task', {
        log(message: string) {
          console.log(message);
          return null;
        },
      });
    },
  },
});
