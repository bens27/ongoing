import { expect, test, type Page } from '@playwright/test';
import { ongoing, ongoingJson } from './cli';

/**
 * The inventory shell. Every mutation here is checked twice: once in the browser, once through
 * `bin/ongoing` against the same server, so the phase cannot quietly introduce a UI-only
 * capability (ADR 0008, AGENTS.md).
 */

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (error) => {
    throw error;
  });
});

async function hydrated(page: Page) {
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

test('the URL is the query: filter, sort, and columns round-trip and match the CLI', async ({
  page
}) => {
  await page.goto('/');
  await hydrated(page);
  await expect(page.getByRole('link', { name: 'ongoing home' })).toBeVisible();
  await expect(page.locator('[data-entry-row]').first()).toHaveAttribute('data-entry-row', 'alpha');

  // `/` with an empty URL is a real query, shown in the filter box rather than hidden state.
  const filter = page.getByRole('searchbox', { name: 'Filter inventory' });
  await expect(filter).toHaveValue('kind:project is_hidden:false');

  await page.keyboard.press('/');
  await expect(filter).toBeFocused();
  await filter.fill('kind:project is_favorite:true');
  await filter.press('Enter');
  await expect(page).toHaveURL(/q=kind%3Aproject\+is_favorite%3Atrue/);
  await expect(page.locator('[data-entry-row]')).toHaveCount(1);

  // The same string is an `ongoing list` argument, and answers with the same rows — including the
  // defaults both surfaces prepend, so the hidden favourite is absent on both.
  const fromCli = ongoing('list', 'kind:project is_favorite:true', '--ids');
  expect(fromCli.split('\n').filter(Boolean)).toHaveLength(1);

  await page.goto('/?q=kind%3Aproject&sort=-loc.code&columns=name,loc.code');
  await hydrated(page);
  await expect(page.locator('[data-entry-row]').first()).toHaveAttribute('data-entry-row', 'beta');
  await expect(page.getByRole('button', { name: 'Sort by Lines of code' })).toBeVisible();
  // `--no-group` because `ongoing list` floats favourites to the top by default and the browser
  // sorts by exactly the keys in the URL.
  const sorted = ongoingJson<{ name: string }[]>(
    'list',
    'kind:project',
    '--sort',
    '-loc.code',
    '--no-group',
    '--json'
  );
  expect(sorted[0].name).toBe('beta');
});

test('a saved view is created in the browser and the CLI lists it', async ({ page }) => {
  await page.goto('/?q=kind%3Aproject+github.stars%3E%3D100');
  await hydrated(page);
  page.once('dialog', (dialog) => void dialog.accept('browser-saved'));
  await page.getByRole('button', { name: /save view/i }).click();
  await expect(page.getByRole('link', { name: /browser-saved/ })).toBeVisible();

  expect(ongoing('views')).toContain('browser-saved');
  // `--json` projects the view's own columns, so `name` is what comes back.
  const viaSaved = ongoingJson<{ name: string }[]>('list', '--saved', 'browser-saved', '--json');
  expect(viaSaved.map((entry) => entry.name)).toEqual(['alpha']);

  // The view the browser saved is deletable from the CLI, which is the same contract.
  ongoing('view', 'delete', 'browser-saved');
  expect(ongoing('views')).not.toContain('browser-saved');
});

test('an inline edit is optimistic, reaches the CLI, and undoes', async ({ page }) => {
  await page.goto('/?q=kind%3Aproject&columns=name,intent');
  await hydrated(page);

  const cell = page.getByRole('button', { name: 'Edit Intent for beta' });
  await cell.click();
  await page.getByRole('combobox', { name: 'Intent for beta' }).selectOption('invest');

  // Optimistic: the cell shows the new value before anything is re-fetched.
  await expect(page.getByRole('button', { name: 'Edit Intent for beta' })).toHaveText('invest');
  await expect(page.getByRole('status')).toContainText('Intent saved');

  expect(ongoing('get', 'beta', 'intent')).toBe('invest');

  // Undo is a patch like any other, through the same endpoint.
  await page.getByRole('button', { name: /undo/i }).click();
  await expect(page.getByRole('button', { name: 'Edit Intent for beta' })).toHaveText('—');
  expect(ongoing('get', 'beta', 'intent')).toBe('');
});

test('a refused edit rolls back and shows the error the CLI would show', async ({ page }) => {
  await page.goto('/?q=kind%3Aproject&columns=name,excitement');
  await hydrated(page);
  await page.getByRole('button', { name: 'Edit Excitement for alpha' }).click();
  const editor = page.getByRole('spinbutton', { name: 'Excitement for alpha' });
  await editor.fill('9');
  await editor.press('Enter');
  // The editor stays open with the message beside it — inline feedback, no toast, nothing saved.
  await expect(page.getByRole('alert')).toContainText('must be at most 5');
  await expect(editor).toBeVisible();
  expect(ongoing('get', 'alpha', 'excitement')).toBe('');
  await editor.press('Escape');
});

test('keyboard: j/k move, Enter opens the panel, and the panel links to the fact sheet', async ({
  page
}) => {
  await page.goto('/?q=kind%3Aproject');
  await hydrated(page);
  await page.keyboard.press('j');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/entry=project%2Fbeta/);
  const panel = page.getByRole('complementary', { name: /beta details/ });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('heading', { level: 2 })).toContainText('beta');
  await expect(panel).toContainText('Needs attention');

  await panel.getByRole('link', { name: /fact sheet/i }).click();
  // The link back to the inventory carries the list it was opened from, so it is a `?from=` param
  // rather than a bare path.
  await expect(page).toHaveURL(/\/p\/beta\?from=/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('beta');

  // The fact sheet returns to that exact list: same query, and beta's panel reopened.
  await page.getByRole('link', { name: /inventory/i }).click();
  await expect(page).toHaveURL(/q=kind%3Aproject.*entry=project%2Fbeta/);
  await expect(page.getByRole('complementary', { name: /beta details/ })).toBeVisible();
});

test('a direct fact sheet link loads without visiting the inventory first', async ({ page }) => {
  await page.goto('/p/alpha');
  await hydrated(page);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('alpha');
  // No `from` was carried in, so the plain return link resets to the default list.
  await expect(page.getByRole('link', { name: /inventory/i })).toHaveAttribute('href', '/');
});

test('the fact sheet returns to the inventory with its scroll position kept', async ({ page }) => {
  // A short viewport keeps the seeded rows taller than the list, so there is something to scroll.
  await page.setViewportSize({ width: 1280, height: 90 });
  await page.goto('/?q=kind%3Aproject&entry=project%2Falpha');
  await hydrated(page);
  const scrollBox = page.locator('.table-scroll');
  const before = await scrollBox.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    return element.scrollTop;
  });
  expect(before).toBeGreaterThan(0);

  await page
    .getByRole('complementary', { name: 'alpha details' })
    .getByRole('link', { name: /fact sheet/i })
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('alpha');

  await page.getByRole('link', { name: /inventory/i }).click();
  await hydrated(page);
  await expect.poll(() => scrollBox.evaluate((element) => element.scrollTop)).toBe(before);
});

test('returning from the fact sheet syncs the active row, so a palette command acts on the right project', async ({
  page
}) => {
  await page.goto('/?q=kind%3Aproject');
  await hydrated(page);
  // beta is not the first row, so an active row left pointed at row 0 would be a different
  // project than the one whose panel is actually open.
  const firstRowSlug = await page
    .locator('[data-entry-row]')
    .first()
    .getAttribute('data-entry-row');
  expect(firstRowSlug).not.toBe('beta');
  const firstRowFavoriteBefore = ongoing('get', firstRowSlug!, 'is_favorite');

  await page
    .locator('[data-entry-row="beta"]')
    .getByRole('button', { name: 'beta', exact: true })
    .click();
  await page
    .getByRole('complementary', { name: 'beta details' })
    .getByRole('link', { name: /fact sheet/i })
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('beta');

  await page.getByRole('link', { name: /inventory/i }).click();
  await hydrated(page);
  await expect(page.getByRole('complementary', { name: 'beta details' })).toBeVisible();
  // The row the panel reopened on is the active row, not whichever row sorts first.
  await expect(page.locator('[data-entry-row="beta"]')).toHaveAttribute('data-active', 'true');

  try {
    await page.keyboard.press('ControlOrMeta+k');
    await page.getByRole('textbox', { name: 'Command palette' }).fill('Add to favorites');
    await page.getByRole('option', { name: 'Add to favorites' }).click();
    await expect.poll(() => ongoing('get', 'beta', 'is_favorite')).toBe('true');
    expect(ongoing('get', firstRowSlug!, 'is_favorite')).toBe(firstRowFavoriteBefore);
  } finally {
    ongoing('set', 'beta', 'is_favorite', 'false');
  }
});

test('the project panel leads with identity, priority, and activity, and its numbers match the CLI', async ({
  page
}) => {
  await page.goto('/?q=kind%3Aproject&entry=project%2Falpha');
  await hydrated(page);
  const panel = page.getByRole('complementary', { name: 'alpha details' });
  await expect(panel).toBeVisible();

  // Reading order: identity, then what needs you, then whether it is moving.
  const identity = panel.getByRole('heading', { level: 2 });
  await expect(identity).toContainText('alpha');
  await expect(panel).toContainText('release after parser cleanup');
  await expect(panel.getByRole('link', { name: /Repository/ })).toHaveAttribute(
    'href',
    'https://github.com/example/alpha'
  );
  // The website action comes from the configured site document, the same one `ongoing export`
  // publishes — not from whichever url field happens to be registered.
  await expect(panel.getByRole('link', { name: /Website/ })).toHaveAttribute(
    'href',
    'https://alpha.example/'
  );

  // The primary item is chosen by the documented ranking: a blocked td item is a tier-1 blocker
  // and outranks the overdue external PR, the stale item, and every positive signal alpha has.
  const priority = panel.getByRole('region', { name: 'Priority and next action' });
  await expect(priority.getByRole('heading', { level: 3 })).toHaveText('1 blocked TD item(s)');
  await expect(priority).toContainText('failure or blocker');
  await priority.getByRole('button', { name: 'Why this?' }).click();
  await expect(priority).toContainText('tdBlockedCount: 1 > 0');
  await expect(priority).toContainText('Source: td');
  const more = priority.getByRole('button', { name: /\+\d+ more/ });
  await more.click();
  await expect(priority.getByRole('list')).toContainText('Oldest external PR is 37 days old');
  await expect(priority.getByRole('list')).toContainText('18 commits in 30 days');

  // Activity: the commit headline and the three disjoint rates, from the same totals the CLI
  // prints: (31 − 18) / 60 = 0.2, (18 − 8) / 23 = 0.4, 8 / 7 = 1.1.
  const signals = panel.getByRole('region', { name: 'Project signals' });
  await expect(signals.locator('[data-metric="commits30d"]')).toHaveText('18');
  expect(ongoing('get', 'alpha', 'git.commits30d')).toBe('18');
  await expect(signals.getByRole('img')).toHaveAttribute(
    'aria-label',
    'Average commits per day: days 90–31, 0.2; days 30–8, 0.4; last 7 days, 1.1'
  );
  await expect(signals).toContainText('9 active days of 30');

  // Reach and Codebase are one Tab stop with arrow keys between them.
  await signals.getByRole('tab', { name: 'Activity' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(signals.getByRole('tab', { name: 'Reach' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await expect(signals.getByRole('tab', { name: 'Reach' })).toBeFocused();
  await expect(signals.locator('[data-metric="stars"]')).toHaveText('120');
  await page.keyboard.press('ArrowRight');
  await expect(signals).toContainText('lines of code');
  await expect(signals).toContainText('not a health, productivity, or test-coverage score');
});

test('the panel sets a next action through the catalog, the CLI sees it, and undo reverts it', async ({
  page
}) => {
  await page.goto('/?q=kind%3Aproject&entry=project%2Falpha');
  await hydrated(page);
  const panel = page.getByRole('complementary', { name: 'alpha details' });
  const priority = panel.getByRole('region', { name: 'Priority and next action' });

  await priority.getByRole('button', { name: 'Set next action' }).click();
  const editor = priority.getByRole('textbox', { name: 'Next action for alpha' });
  await editor.fill('cut the 2.2 release');
  await priority.getByRole('button', { name: 'Save next action' }).click();
  // Optimistic: the stored next action shows under the blocker before the round trip lands.
  await expect(priority).toContainText('cut the 2.2 release');
  await expect(page.getByRole('status')).toContainText('Next action saved');
  expect(ongoing('get', 'alpha', 'next_action')).toBe('cut the 2.2 release');

  // Undo is a patch through the same endpoint; `ongoing set alpha next_action none` is the same.
  await page.getByRole('button', { name: /undo/i }).click();
  await expect(priority).not.toContainText('cut the 2.2 release');
  await expect(priority.getByRole('button', { name: 'Set next action' })).toBeVisible();
  expect(ongoing('get', 'alpha', 'next_action')).toBe('');
});

test('a refused save from the panel rolls back and shows the server’s reason', async ({ page }) => {
  await page.goto('/?q=kind%3Aproject&entry=project%2Fbeta');
  await hydrated(page);
  await page.route('**/api/entries/project/beta', (route) =>
    route.request().method() === 'PATCH'
      ? route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'the catalog is read-only right now' })
        })
      : route.continue()
  );
  const panel = page.getByRole('complementary', { name: 'beta details' });
  const priority = panel.getByRole('region', { name: 'Priority and next action' });
  await priority.getByRole('button', { name: 'Set next action' }).click();
  await priority.getByRole('textbox', { name: 'Next action for beta' }).fill('will not stick');
  await priority.getByRole('button', { name: 'Save next action' }).click();

  await expect(page.getByRole('status')).toContainText('the catalog is read-only right now');
  // The optimistic value is gone, the editor is closed, and the CLI never saw it.
  await expect(priority).not.toContainText('will not stick');
  await expect(priority.getByRole('button', { name: 'Set next action' })).toBeVisible();
  expect(ongoing('get', 'beta', 'next_action')).toBe('');
  await page.unroute('**/api/entries/project/beta');
});

test('disclosures and a half-typed draft survive tab switches and a data refresh, but not a project change', async ({
  page
}) => {
  await page.goto('/?q=kind%3Aproject&entry=project%2Fbeta');
  await hydrated(page);
  const panel = page.getByRole('complementary', { name: 'beta details' });
  const work = panel.locator('details[data-section="Work in motion"]');
  await work.locator('summary').click();
  await expect(work).toHaveAttribute('open', '');

  const priority = panel.getByRole('region', { name: 'Priority and next action' });
  await priority.getByRole('button', { name: 'Set next action' }).click();
  const editor = priority.getByRole('textbox', { name: 'Next action for beta' });
  await editor.fill('half-typed');
  try {
    // Switching signal tabs neither submits nor loses the draft, and leaves the disclosure open.
    const signals = panel.getByRole('region', { name: 'Project signals' });
    await signals.getByRole('tab', { name: 'Reach' }).click();
    await signals.getByRole('tab', { name: 'Activity' }).click();
    await expect(editor).toHaveValue('half-typed');
    await expect(work).toHaveAttribute('open', '');

    // Another edit on the same project replaces its row with the server's answer — a refresh of
    // the data the panel reads. The draft and the disclosure belong to the project, not the row.
    await panel.getByRole('button', { name: 'More actions for beta' }).click();
    await page.getByRole('menuitem', { name: 'Add to favorites' }).click();
    await expect(page.getByRole('status')).toContainText('Favorite saved');
    await expect.poll(() => ongoing('get', 'beta', 'is_favorite')).toBe('true');
    await expect(editor).toHaveValue('half-typed');
    await expect(work).toHaveAttribute('open', '');
    expect(ongoing('get', 'beta', 'next_action')).toBe('');

    // Moving to another project starts fresh: nothing leaks from beta into dormant. The list's
    // cursor is already on beta — the row the open panel belongs to — so one step down reaches
    // the next project.
    await priority.getByRole('button', { name: 'Cancel' }).click();
    await page.keyboard.press('j');
    const next = page.getByRole('complementary', { name: 'dormant details' });
    await expect(next).toBeVisible();
    await expect(next.locator('details[data-section="Work in motion"]')).not.toHaveAttribute(
      'open',
      ''
    );
    await expect(next.getByRole('textbox', { name: /Next action/ })).toHaveCount(0);
  } finally {
    ongoing('set', 'beta', 'is_favorite', 'false');
  }
});

test('the panel keeps every action reachable by keyboard and inspects every registered field', async ({
  page
}) => {
  // A custom field registered a moment ago is as findable and editable as a built-in one.
  ongoing('field', 'add', 'x.customer', '--type', 'text', '--label', 'Customer');
  // An unrelated custom url field is a fact, not the project's website: beta has no configured
  // site, so the Website action must stay absent however this field is filled.
  ongoing('field', 'add', 'x.homepage', '--type', 'url', '--label', 'Homepage');
  ongoing('set', 'beta', 'x.homepage', 'https://unrelated.example');
  try {
    await page.goto('/?q=kind%3Aproject&entry=project%2Fbeta');
    await hydrated(page);
    const beta = page.getByRole('complementary', { name: 'beta details' });
    await expect(beta).toBeVisible();
    await expect(beta.getByRole('link', { name: /Website/ })).toHaveCount(0);
    await beta.getByRole('button', { name: 'More actions for beta' }).click();
    await expect(page.getByRole('menuitem', { name: 'Open website' })).toHaveCount(0);
    await page.keyboard.press('Escape');

    await page.goto('/?q=kind%3Aproject&entry=project%2Falpha');
    await hydrated(page);
    const panel = page.getByRole('complementary', { name: 'alpha details' });
    await panel.getByRole('button', { name: 'More actions for alpha' }).click();
    await expect(page.getByRole('menuitem', { name: 'Open website' })).toBeVisible();
    await page.keyboard.press('Escape');

    // The actions menu: a real menu with arrow keys, and Escape returns to the trigger.
    const trigger = panel.getByRole('button', { name: 'More actions for alpha' });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const menu = page.getByRole('menu', { name: 'More actions for alpha' });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Remove from favorites' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(menu.getByRole('menuitem', { name: 'Hide' })).toBeFocused();
    await expect(menu.getByRole('menuitem', { name: 'Open in Terminal' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Open on GitHub' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Command palette' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();
    // Escape inside the menu closed the menu, not the panel.
    await expect(panel).toBeVisible();

    // Rename is an ordinary edit of the `name` field, cancelled here.
    await trigger.click();
    await page.getByRole('menuitem', { name: 'Rename' }).click();
    const name = panel.getByRole('textbox', { name: 'Name for alpha' });
    await expect(name).toBeFocused();
    await name.press('Escape');
    await expect(panel.getByRole('heading', { level: 2 })).toContainText('alpha');

    // The inspector: opened from the footer, searchable, and closed with focus restored.
    const opener = panel.getByRole('button', { name: 'All fields & sources' });
    await opener.click();
    const inspector = page.getByRole('dialog', { name: /All fields & sources/ });
    await expect(inspector).toBeVisible();
    const search = inspector.getByRole('searchbox', { name: 'Search fields' });
    await expect(search).toBeFocused();
    await expect(inspector.locator('[data-field="git.commits90d"]')).toContainText('31');
    // Empty fields are discoverable, not hidden.
    await expect(inspector.locator('[data-field="excitement"]')).toContainText('—');
    await search.fill('customer');
    await expect(inspector.locator('tbody tr')).toHaveCount(1);
    await inspector.getByRole('button', { name: 'Edit Customer for alpha' }).click();
    const customer = inspector.getByRole('textbox', { name: 'Customer for alpha' });
    await customer.fill('acme');
    await customer.press('Enter');
    await expect.poll(() => ongoing('get', 'alpha', 'x.customer')).toBe('acme');
    await expect(inspector.locator('[data-field="x.customer"]')).toContainText('acme');
    await search.fill('');
    await expect(inspector).toContainText('Collector warnings');
    await expect(inspector).toContainText('filesystem · /code/alpha');
    await page.keyboard.press('Escape');
    await expect(inspector).toBeHidden();
    await expect(opener).toBeFocused();
    await expect(panel).toBeVisible();
  } finally {
    ongoing('field', 'remove', 'x.customer', '--yes');
    ongoing('field', 'remove', 'x.homepage', '--yes');
  }
});

test('technology entries keep the generic, registry-driven panel', async ({ page }) => {
  await page.goto('/?q=kind%3Atechnology&entry=technology%2Fgo');
  await hydrated(page);
  const panel = page.getByRole('complementary', { name: 'Go details' });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Decisions');
  await expect(panel.getByRole('button', { name: 'Edit Ring for Go' })).toBeVisible();
  await expect(panel).not.toContainText('Project overview');
});

test('the project panel is the wide shell variant; generic panels keep the default width at every size', async ({
  page
}) => {
  const width = async (name: string) =>
    (await page.getByRole('complementary', { name }).boundingBox())?.width;
  // Both widths are the two panel tokens, read from the root so the assertion follows the tokens.
  const tokens = await (async () => {
    await page.goto('/');
    await hydrated(page);
    return page.evaluate(() => {
      const styles = getComputedStyle(document.documentElement);
      return {
        panel: parseFloat(styles.getPropertyValue('--panel-width')),
        wide: parseFloat(styles.getPropertyValue('--panel-width-wide'))
      };
    });
  })();
  expect(tokens).toEqual({ panel: 400, wide: 520 });

  for (const [viewport, expected] of [
    [1440, tokens.wide],
    [1365, tokens.panel]
  ] as const) {
    await page.setViewportSize({ width: viewport, height: 900 });
    await page.goto('/?q=kind%3Aproject&entry=project%2Falpha');
    await hydrated(page);
    expect(await width('alpha details'), `project panel at ${viewport}`).toBe(expected);
    await page.goto('/?q=kind%3Atechnology&entry=technology%2Fgo');
    await hydrated(page);
    expect(await width('Go details'), `technology panel at ${viewport}`).toBe(tokens.panel);
  }
});

test('reach and codebase charts expose observations with one Tab stop and arrow keys', async ({
  page
}) => {
  await page.goto('/?q=kind%3Aproject&entry=project%2Falpha');
  await hydrated(page);
  const panel = page.getByRole('complementary', { name: 'alpha details' });
  const signals = panel.getByRole('region', { name: 'Project signals' });

  await signals.getByRole('tab', { name: 'Reach' }).click();
  const reach = signals.locator('[data-chart="reach"]');
  await expect(reach.locator('[data-history-metric="github_stars"]')).toHaveAttribute(
    'data-chart-state',
    'series'
  );
  await expect(reach.getByRole('group')).toHaveAttribute('aria-label', /stars from 100 to 120/i);
  await expect(reach).toContainText('axis does not start at 0');
  const points = reach.locator('[data-point]');
  await expect(points).toHaveCount(5);
  await points.first().focus();
  await expect(reach.locator('.readout')).toContainText('100 stars');
  await page.keyboard.press('ArrowRight');
  await expect(reach.locator('.readout')).toContainText('105 stars');
  await page.keyboard.press('End');
  await expect(reach.locator('.readout')).toContainText('120 stars');
  await page.keyboard.press('Home');
  await expect(reach.locator('.readout')).toContainText('100 stars');
  // One Tab stop: Tab leaves the chart rather than walking each point.
  await page.keyboard.press('Tab');
  await expect(points.first()).not.toBeFocused();
  await expect(points.nth(1)).not.toBeFocused();

  await signals.getByRole('tab', { name: 'Codebase' }).click();
  const codebase = signals.locator('[data-chart="codebase"]');
  await expect(codebase.locator('[data-history-metric="loc_code"]')).toHaveAttribute(
    'data-chart-state',
    'series'
  );
  await expect(codebase.getByRole('group')).toHaveAttribute('aria-label', /lines of code from/i);
  await expect(codebase).toContainText('axis does not start at 0');
  await expect(codebase.locator('[data-point]')).toHaveCount(3);
});

test('a late history response does not replace another project’s chart', async ({ page }) => {
  await page.goto('/?q=kind%3Aproject&entry=project%2Falpha');
  await hydrated(page);

  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/entries/project/alpha/history**', async (route) => {
    await held;
    try {
      await route.continue();
    } catch {
      // The test may have finished (or navigated) before the delayed request was released.
    }
  });

  try {
    const alpha = page.getByRole('complementary', { name: 'alpha details' });
    await alpha.getByRole('tab', { name: 'Reach' }).click();
    await expect(alpha.locator('[data-chart-state="loading"]')).toBeVisible();

    await page
      .locator('[data-entry-row="dormant"]')
      .getByRole('button', { name: 'dormant', exact: true })
      .click();
    const dormant = page.getByRole('complementary', { name: 'dormant details' });
    await expect(dormant).toBeVisible();
    await dormant.getByRole('tab', { name: 'Reach' }).click();
    const chart = dormant.locator('[data-chart="reach"]');
    await expect(chart.locator('[data-history-metric="github_stars"]')).toHaveAttribute(
      'data-chart-state',
      'single'
    );
    await expect(chart).toContainText('0 stars');
    await expect(chart).not.toContainText('100 stars');

    const arrived = page.waitForResponse((response) =>
      response.url().includes('/api/entries/project/alpha/history')
    );
    release();
    await arrived;
    await expect(chart.locator('[data-history-metric="github_stars"]')).toHaveAttribute(
      'data-chart-state',
      'single'
    );
    await expect(chart).toContainText('0 stars');
    await expect(chart).not.toContainText('100 stars');
    await expect(page.getByRole('complementary', { name: 'alpha details' })).toHaveCount(0);
  } finally {
    release();
    await page.unroute('**/api/entries/project/alpha/history**');
  }
});

test('dated charts stay operable under reduced motion and missing collection stays text', async ({
  page
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?q=kind%3Aproject&entry=project%2Falpha');
  await hydrated(page);
  const alpha = page.getByRole('complementary', { name: 'alpha details' });
  const signals = alpha.getByRole('region', { name: 'Project signals' });
  await signals.getByRole('tab', { name: 'Reach' }).click();
  const reach = signals.locator('[data-chart="reach"]');
  await expect(reach.locator('[data-history-metric="github_stars"]')).toHaveAttribute(
    'data-motion',
    'reduce'
  );
  const points = reach.locator('[data-point]');
  await points.first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(reach.locator('.readout')).toContainText('105 stars');

  await page.goto('/?q=kind%3Aproject&entry=project%2Fbeta');
  await hydrated(page);
  const beta = page.getByRole('complementary', { name: 'beta details' });
  await beta.getByRole('tab', { name: 'Codebase' }).click();
  const codebase = beta.locator('[data-chart="codebase"]');
  await expect(codebase.locator('[data-chart-state="unavailable"]')).toBeVisible();
  await expect(codebase).toContainText('were not collected');
  await expect(codebase).not.toContainText('—');
});

test('the palette jumps to an entry and runs a command with a CLI equivalent', async ({ page }) => {
  await page.goto('/?q=kind%3Aproject');
  await hydrated(page);
  await page.keyboard.press('ControlOrMeta+k');
  const palette = page.getByRole('textbox', { name: 'Command palette' });
  await expect(palette).toBeFocused();
  // A fuzzy jump: `cafe` finds `café catalog` through its slug.
  await palette.fill('cafe');
  await page
    .getByRole('option', { name: /café catalog/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/p\/cafe-catalog$/);

  // Favourite through the palette, then read it back with `ongoing list`.
  await page.keyboard.press('ControlOrMeta+k');
  await page.getByRole('textbox', { name: 'Command palette' }).fill('Add to favorites');
  await page.getByRole('option', { name: 'Add to favorites' }).click();
  await expect
    .poll(() => ongoing('list', 'kind:project is_favorite:true', '--ids').split('\n').length)
    .toBe(2);
  // `set` addresses an entry by slug; `favorite` takes a project name or path.
  ongoing('set', 'cafe-catalog', 'is_favorite', 'false');
});

/**
 * The fact sheet composes the same `ui/project/*` sections the panel does, arranged wider on
 * `/p/<slug>`: identity and priority side by side at the top, Activity/Codebase and their
 * disclosures on the left, Reach and its disclosures on the right. These tests prove the reading
 * order, the same actions/inspector/edit behaviour the panel has, and technology's unchanged
 * generic path (docs/plans/active/project-detail-redesign.md, slice 3).
 */
test('the fact sheet leads with identity and priority, then Activity/Codebase beside Reach, and edits a note in place', async ({
  page
}) => {
  await page.goto('/p/alpha');
  await hydrated(page);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('alpha');
  const factsheet = page.locator('[data-project-factsheet="alpha"]');

  const priority = factsheet.getByRole('region', { name: 'Priority and next action' });
  await expect(priority.getByRole('heading', { level: 3 })).toHaveText('1 blocked TD item(s)');
  await priority.getByRole('button', { name: 'Why this?' }).click();
  await expect(priority).toContainText('tdBlockedCount: 1 > 0');

  // Activity/Codebase are the only real tabs here; Reach runs beside them the whole time rather
  // than behind a third tab, since the wide layout has the room the panel does not.
  const signals = factsheet.getByRole('region', { name: 'Project signals' });
  await expect(signals.getByRole('tab')).toHaveCount(2);
  await expect(signals.getByRole('tab', { name: 'Reach' })).toHaveCount(0);
  await signals.getByRole('tab', { name: 'Activity' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(signals.getByRole('tab', { name: 'Codebase' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(signals.getByRole('tab', { name: 'Activity' })).toBeFocused();

  const reach = factsheet.getByRole('region', { name: 'Reach' });
  await expect(reach).toBeVisible();
  await expect(reach).toContainText('120');

  // Same note field, same editor, as the panel and the CLI.
  const notes = factsheet.locator('details[data-section="Notes & decisions"]');
  await notes.locator('summary').click();
  await notes.getByRole('button', { name: 'Edit Note for alpha' }).click();
  const note = page.getByRole('textbox', { name: 'Note for alpha' });
  await note.fill('edited from the fact sheet');
  await note.press('ControlOrMeta+Enter');
  await expect.poll(() => ongoing('get', 'alpha', 'note')).toBe('edited from the fact sheet');
  ongoing('note', 'alpha', 'release after parser cleanup');
});

test('the fact sheet keeps every panel action reachable and inspects a custom field', async ({
  page
}) => {
  ongoing('field', 'add', 'x.customer', '--type', 'text', '--label', 'Customer');
  try {
    await page.goto('/p/alpha');
    await hydrated(page);
    const factsheet = page.locator('[data-project-factsheet="alpha"]');

    const trigger = factsheet.getByRole('button', { name: 'More actions for alpha' });
    await trigger.click();
    const menu = page.getByRole('menu', { name: 'More actions for alpha' });
    await expect(menu.getByRole('menuitem', { name: 'Open on GitHub' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Open in Terminal' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Command palette' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();

    // The inspector: the same searchable dialog, the same access point, from the footer.
    const opener = factsheet.getByRole('button', { name: 'All fields & sources' });
    await opener.click();
    const inspector = page.getByRole('dialog', { name: /All fields & sources/ });
    await expect(inspector).toBeVisible();
    const search = inspector.getByRole('searchbox', { name: 'Search fields' });
    await expect(search).toBeFocused();
    await search.fill('customer');
    await inspector.getByRole('button', { name: 'Edit Customer for alpha' }).click();
    const customer = inspector.getByRole('textbox', { name: 'Customer for alpha' });
    await customer.fill('acme');
    await customer.press('Enter');
    await expect.poll(() => ongoing('get', 'alpha', 'x.customer')).toBe('acme');
    await expect(inspector.locator('[data-field="x.customer"]')).toContainText('acme');
    await page.keyboard.press('Escape');
    await expect(inspector).toBeHidden();
    await expect(opener).toBeFocused();
  } finally {
    ongoing('field', 'remove', 'x.customer', '--yes');
  }
});

test('the fact sheet sets a next action through the catalog, the CLI sees it, and undo reverts it', async ({
  page
}) => {
  await page.goto('/p/dormant');
  await hydrated(page);
  const factsheet = page.locator('[data-project-factsheet="dormant"]');
  const priority = factsheet.getByRole('region', { name: 'Priority and next action' });

  await priority.getByRole('button', { name: 'Set next action' }).click();
  const editor = priority.getByRole('textbox', { name: 'Next action for dormant' });
  await editor.fill('revive or archive');
  await priority.getByRole('button', { name: 'Save next action' }).click();
  await expect(priority).toContainText('revive or archive');
  await expect(page.getByRole('status')).toContainText('Next action saved');
  expect(ongoing('get', 'dormant', 'next_action')).toBe('revive or archive');

  await page.getByRole('button', { name: /undo/i }).click();
  await expect(priority).not.toContainText('revive or archive');
  await expect(priority.getByRole('button', { name: 'Set next action' })).toBeVisible();
  expect(ongoing('get', 'dormant', 'next_action')).toBe('');
});

test('a refused save from the fact sheet rolls back and shows the server’s reason', async ({
  page
}) => {
  await page.goto('/p/beta');
  await hydrated(page);
  await page.route('**/api/entries/project/beta', (route) =>
    route.request().method() === 'PATCH'
      ? route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'the catalog is read-only right now' })
        })
      : route.continue()
  );
  const factsheet = page.locator('[data-project-factsheet="beta"]');
  const priority = factsheet.getByRole('region', { name: 'Priority and next action' });
  await priority.getByRole('button', { name: 'Set next action' }).click();
  await priority.getByRole('textbox', { name: 'Next action for beta' }).fill('will not stick');
  await priority.getByRole('button', { name: 'Save next action' }).click();

  await expect(page.getByRole('status')).toContainText('the catalog is read-only right now');
  await expect(priority).not.toContainText('will not stick');
  expect(ongoing('get', 'beta', 'next_action')).toBe('');
  await page.unroute('**/api/entries/project/beta');
});

test('technology fact sheets keep the generic, registry-driven layout', async ({ page }) => {
  await page.goto('/t/go');
  await hydrated(page);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Go');
  await expect(page.getByText('Decisions')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit Ring for Go' })).toBeVisible();
  await expect(page.locator('[data-project-factsheet]')).toHaveCount(0);
});

test('the fact sheet stacks to one column at 390px, in the same DOM order it uses when wide', async ({
  page
}) => {
  await page.goto('/p/alpha');
  await hydrated(page);
  const factsheet = page.locator('[data-project-factsheet="alpha"]');
  const sections = factsheet.locator('[data-section]');
  const order = await sections.evaluateAll((nodes) => nodes.map((node) => node.dataset.section));
  // Two contiguous groups — Activity/Codebase, Work, Repository, then Reach, Stack, Notes — so a
  // column collapse reads top to bottom exactly as written, never jumping between the two.
  expect(order).toEqual([
    'priority',
    'signals',
    'Work in motion',
    'Repository & release',
    'reach',
    'Stack',
    'Notes & decisions'
  ]);

  const columns = factsheet.locator('[data-column]');
  const wide = await columns.evaluateAll((nodes) =>
    nodes.map((node) => node.getBoundingClientRect())
  );
  expect(wide[1].x).toBeGreaterThan(wide[0].x + wide[0].width - 5);

  await page.setViewportSize({ width: 390, height: 900 });
  const narrow = await columns.evaluateAll((nodes) =>
    nodes.map((node) => node.getBoundingClientRect())
  );
  expect(narrow[1].y).toBeGreaterThanOrEqual(narrow[0].y + narrow[0].height - 5);

  // The DOM itself never reordered; only the layout collapsed.
  const orderNarrow = await sections.evaluateAll((nodes) =>
    nodes.map((node) => node.dataset.section)
  );
  expect(orderNarrow).toEqual(order);
});

test('the radar shows rings with counts, edits a ring, and links into a filtered inventory', async ({
  page
}) => {
  await page.goto('/radar');
  await hydrated(page);
  await expect(page.getByRole('heading', { name: 'hot' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Go 2' })).toBeVisible();

  await page.getByRole('button', { name: 'Edit ring for jQuery' }).click();
  await page.getByRole('combobox', { name: 'Ring for jQuery' }).selectOption('cool');
  await expect.poll(() => ongoing('get', 'jquery', 'ring')).toBe('cool');
  ongoing('set', 'jquery', 'ring', 'out');

  await page.goto('/radar');
  await hydrated(page);
  await page.getByRole('link', { name: 'Go 2' }).click();
  await expect(page).toHaveURL(/q=tech%3Ago/);
  await expect(page.locator('[data-entry-row]')).toHaveCount(2);
});

test('the providers screen renders the same payload ongoing providers prints', async ({ page }) => {
  const cli = ongoingJson<{
    providers: { name: string; state: string; schedule: string; fields: string[] }[];
  }>('providers', '--json');
  expect(cli.providers.length).toBeGreaterThan(0);

  await page.goto('/providers');
  await hydrated(page);
  await expect(page.getByRole('heading', { name: 'Providers' })).toBeVisible();
  await expect(page.locator('[data-provider]')).toHaveCount(cli.providers.length);

  // Same names, same order, same state — the screen is a projection of GET /api/providers, which
  // is the payload the CLI reads. There is no second source of provider truth (ADR 0007).
  const rendered = await page.locator('[data-provider]').evaluateAll((nodes) =>
    nodes.map((node) => ({
      name: node.getAttribute('data-provider'),
      state: node.getAttribute('data-state')
    }))
  );
  expect(rendered).toEqual(
    cli.providers.map((provider) => ({ name: provider.name, state: provider.state }))
  );

  const git = cli.providers.find((provider) => provider.name === 'git');
  expect(git?.fields).toContain('git.commits30d');
  await expect(
    page.locator('[data-provider="git"]').getByText('git.commits30d', { exact: true })
  ).toBeVisible();
});

test('a list operation stays inside the interaction budget', async ({ page }) => {
  await page.goto('/?q=kind%3Aproject&columns=name,loc.code');
  await hydrated(page);
  // Measured inside the page: the time from the click to the table changing. Filtering and sorting
  // are pure functions over rows already in memory, so a list operation never costs a round trip.
  // The 500-entry budget is asserted over the same functions in `query.perf.test.ts`.
  const elapsed = await page.evaluate(async () => {
    const body = document.querySelector('tbody');
    const button = [...document.querySelectorAll('button')].find(
      (candidate) => candidate.getAttribute('aria-label') === 'Sort by Lines of code'
    );
    if (!body || !button) return Number.POSITIVE_INFINITY;
    return await new Promise<number>((done) => {
      const start = performance.now();
      const observer = new MutationObserver(() => {
        observer.disconnect();
        done(performance.now() - start);
      });
      observer.observe(body, { childList: true, subtree: true, characterData: true });
      button.click();
    });
  });
  expect(elapsed).toBeLessThan(100);
});

test('keeps text above the normal-text contrast ratio in both themes', async ({ page }) => {
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
  };
  const luminance = ([red, green, blue]: number[]) =>
    0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
  const contrast = (first: number[], second: number[]) => {
    const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
    return (lighter + 0.05) / (darker + 0.05);
  };

  for (const theme of ['dark', 'light'] as const) {
    await page.goto('/');
    await hydrated(page);
    await page.getByRole('button', { name: `${theme} theme` }).click();
    // The tokens are `lch()`, which the browser does not serialise as `rgb()`. Painting each one
    // into a canvas is the shortest honest conversion to the sRGB the ratio is defined over.
    const colors = await page.evaluate(() => {
      const styles = getComputedStyle(document.documentElement);
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      const rgb = (color: string) => {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
      };
      return {
        background: rgb(getComputedStyle(document.body).backgroundColor),
        primary: rgb(styles.getPropertyValue('--text-primary')),
        secondary: rgb(styles.getPropertyValue('--text-secondary')),
        tertiary: rgb(styles.getPropertyValue('--text-tertiary'))
      };
    });
    expect(contrast(colors.primary, colors.background)).toBeGreaterThan(7);
    expect(contrast(colors.secondary, colors.background)).toBeGreaterThan(4.5);
    // Tertiary carries labels and counts, never prose; it clears large-text contrast.
    expect(contrast(colors.tertiary, colors.background)).toBeGreaterThan(3);
  }
});
