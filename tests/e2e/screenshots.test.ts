import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * The screen record in `docs/qa/screens/`. Skipped by default — it writes tracked files, and a
 * screenshot that changes on every unrelated run is noise rather than evidence. Regenerate with:
 *
 * ```sh
 * QA_SCREENSHOTS=1 E2E_PORT=7801 bun run test:e2e tests/e2e/screenshots.test.ts
 * ```
 *
 * Every screen is captured in both themes. A screen names its own viewport when the point of the
 * record is a breakpoint: the project panel is 520px wide at 1440 and 400px below 1366, and both
 * the panel and the fact sheet collapse to one column at a 390px phone width.
 */
const enabled = Boolean(process.env.QA_SCREENSHOTS);
const directory = resolve(import.meta.dirname, '../../docs/qa/screens');

const DESKTOP = { width: 1440, height: 900 };
const COMPACT = { width: 1280, height: 900 };
const PHONE = { width: 390, height: 900 };

async function hydrated(page: Page) {
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

test.describe('screen record', () => {
  test.skip(!enabled, 'set QA_SCREENSHOTS=1 to regenerate docs/qa/screens');
  test.use({ viewport: DESKTOP });

  const screens: {
    name: string;
    viewport?: { width: number; height: number };
    fullPage?: boolean;
    go: (page: Page) => Promise<void>;
  }[] = [
    ...[DESKTOP, PHONE].map((viewport) => ({
      name: viewport === PHONE ? 'query-help-phone' : 'query-help',
      viewport,
      go: async (page: Page) => {
        await page.goto('/');
        await hydrated(page);
        await page.getByRole('button', { name: 'Query language help' }).click();
        await expect(page.getByRole('dialog', { name: 'Query the catalog' })).toBeVisible();
      }
    })),
    {
      name: 'inventory',
      go: async (page) => {
        await page.goto('/');
      }
    },
    {
      // The project overview panel at its wide width, 520px, beside the inventory.
      name: 'inventory-panel',
      go: async (page) => {
        await page.goto('/?q=kind%3Aproject&entry=project%2Falpha');
      }
    },
    {
      // The same panel below the 1366px breakpoint, where it falls back to 400px so the list
      // keeps its columns.
      name: 'inventory-panel-compact',
      viewport: COMPACT,
      go: async (page) => {
        await page.goto('/?q=kind%3Aproject&entry=project%2Falpha');
      }
    },
    {
      // The panel at a phone width: it takes the full width and the sections stack.
      name: 'inventory-panel-narrow',
      viewport: PHONE,
      fullPage: true,
      go: async (page) => {
        await page.goto('/?q=kind%3Aproject&entry=project%2Falpha');
      }
    },
    {
      // The searchable registry inspector, reached from the panel footer: every field, custom or
      // empty, with its provider and source timestamp.
      name: 'inventory-panel-inspector',
      go: async (page) => {
        await page.goto('/?q=kind%3Aproject&entry=project%2Falpha');
        await hydrated(page);
        await page.getByRole('button', { name: /all fields/i }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
      }
    },
    {
      name: 'inventory-columns',
      go: async (page) => {
        await page.goto('/?saved=attention');
        await page.getByRole('button', { name: /columns/i }).click();
      }
    },
    {
      // The project fact sheet: identity and priority side by side, Activity/Codebase beside Reach.
      name: 'fact-sheet-project',
      go: async (page) => {
        await page.goto('/p/alpha');
      }
    },
    {
      // The fact sheet at a phone width: one column, in the same DOM order.
      name: 'fact-sheet-project-narrow',
      viewport: PHONE,
      fullPage: true,
      go: async (page) => {
        await page.goto('/p/alpha');
      }
    },
    {
      name: 'fact-sheet-technology',
      go: async (page) => {
        await page.goto('/t/go');
      }
    },
    {
      name: 'radar',
      go: async (page) => {
        await page.goto('/radar');
      }
    },
    {
      name: 'providers',
      go: async (page) => {
        await page.goto('/providers');
        await expect(page.getByRole('heading', { name: 'github', exact: true })).toBeVisible();
      }
    },
    {
      name: 'palette',
      go: async (page) => {
        await page.goto('/?q=kind%3Aproject');
        await hydrated(page);
        await page.keyboard.press('ControlOrMeta+k');
        await page.getByRole('textbox', { name: 'Command palette' }).fill('a');
      }
    }
  ];

  for (const theme of ['dark', 'light'] as const)
    for (const screen of screens)
      test(`${screen.name} · ${theme}`, async ({ page }) => {
        mkdirSync(directory, { recursive: true });
        // The theme is chosen at the desktop size, where the control is always reachable, and
        // survives the navigation the screen makes; the viewport changes after that.
        await page.goto('/');
        await hydrated(page);
        await page.getByRole('button', { name: `${theme} theme` }).click();
        if (screen.viewport) await page.setViewportSize(screen.viewport);
        await screen.go(page);
        await hydrated(page);
        // Charts read their history lazily; give the visible one a moment to land so the record
        // shows data rather than a loading state.
        await page.waitForTimeout(400);
        await page.screenshot({
          path: `${directory}/${screen.name}-${theme}.png`,
          fullPage: screen.fullPage ?? false
        });
      });
});
