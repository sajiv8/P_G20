/// <reference types="cypress" />

/**
 * Accessibility checks with axe-core, wired in directly.
 *
 * cypress-axe does not support Cypress 16 yet, and it is only a thin wrapper
 * around injecting axe and calling axe.run(), so it is done here instead.
 *
 * Automated checks find roughly a third of real accessibility problems. The
 * keyboard and screen-reader checks in the test plan still have to be done by
 * hand — a clean run here is a floor, not a pass mark.
 */

export interface AxeViolation {
  id: string;
  impact: string | null;
  help: string;
  helpUrl: string;
  nodes: Array<{ target: string[]; failureSummary?: string }>;
}

declare global {
  namespace Cypress {
    interface Chainable {
      /** Load axe-core into the page under test. */
      injectAxe(): Chainable<void>;
      /**
       * Run axe and fail on any violation at or above `minImpact`.
       * Violations are always logged, even the ones that do not fail.
       */
      checkA11y(label: string, minImpact?: AxeImpact): Chainable<void>;
    }
  }
}

export type AxeImpact = 'minor' | 'moderate' | 'serious' | 'critical';

const IMPACT_ORDER: AxeImpact[] = ['minor', 'moderate', 'serious', 'critical'];

function atOrAbove(impact: string | null, floor: AxeImpact): boolean {
  if (!impact) return false;
  const i = IMPACT_ORDER.indexOf(impact as AxeImpact);
  return i >= 0 && i >= IMPACT_ORDER.indexOf(floor);
}

Cypress.Commands.add('injectAxe', () => {
  // Read the library off disk and evaluate it inside the app's window.
  cy.readFile('node_modules/axe-core/axe.min.js', { log: false }).then(source => {
    cy.window({ log: false }).then(win => {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      win.eval(source as string);
    });
  });
});

Cypress.Commands.add('checkA11y', (label: string, minImpact: AxeImpact = 'serious') => {
  cy.window({ log: false })
    .then({ timeout: 30000 }, win => {
      const axe = (win as unknown as { axe?: { run: (ctx: unknown, opts: unknown) => Promise<unknown> } }).axe;
      if (!axe) throw new Error('axe-core was not injected — call cy.injectAxe() first.');

      return axe.run(win.document, {
        // WCAG 2.1 Level AA, which is the target in the test plan.
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
      }) as Promise<{ violations: AxeViolation[] }>;
    })
    .then(({ violations }) => {
      if (violations.length === 0) {
        cy.task('log', `a11y ${label}: no WCAG 2.1 AA violations`);
        return;
      }

      const lines = violations.map(v => {
        const targets = v.nodes.map(n => n.target.join(' ')).slice(0, 4).join(', ');
        return `  [${v.impact ?? 'unknown'}] ${v.id} — ${v.help}\n      ${v.nodes.length} element(s): ${targets}`;
      });

      cy.task('log', `a11y ${label}: ${violations.length} violation type(s)\n${lines.join('\n')}`);

      const blocking = violations.filter(v => atOrAbove(v.impact, minImpact));
      if (blocking.length > 0) {
        const summary = blocking.map(v => `${v.id} (${v.impact})`).join(', ');
        throw new Error(
          `${label}: ${blocking.length} ${minImpact}-or-worse accessibility violation(s): ${summary}`,
        );
      }
    });
});

export {};
