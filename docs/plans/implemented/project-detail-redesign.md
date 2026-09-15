# Project panel and factsheet redesign

Status: implemented and activated in production on 2026-09-14 (`td-c3481c`, build activated by
`ongoing restart --build` at e722af5). All four slices are merged to `main`.

## Outcome

Opening a project should answer, in order: what is this project, what needs my attention, is it
moving, and where can I inspect the supporting evidence? The panel supports quick decisions while
keeping the inventory visible. The factsheet supports a longer project review using the same
content, rules, actions, and components.

Avoid a long provider-by-provider facts list. Reserve key/value rows for the searchable field
inspector and cases where a precise mapping is the clearest representation. Keep the complete
registry discoverable; visual prioritization must not remove capabilities or data.

## Design references and authority

- [Interactive panel and factsheet](../../mockups/project-detail/index.html): self-contained HTML,
  checked into the repository. Use the **Panel / Factsheet** toggle, project picker, theme control,
  and panel-width control. No running application or external assets are required to render it.
- [Mockup guide](../../mockups/project-detail/README.md): opening and interaction instructions.
- Running local preview: [panel](http://127.0.0.1:7816/?view=panel&project=sidecar) and
  [factsheet](http://127.0.0.1:7816/?view=factsheet&project=sidecar). These URLs depend on the preview
  process; the checked-in HTML is the durable reference.
- [Shared composition, as built](../../diagrams/fractal/artifacts/project-detail-redesign.svg) and
  the `project-detail-redesign` scene in the repository-owned Fractal model.
- [Current design system](../../../DESIGN.md) and [inventory design](../implemented/ongoing-inventory-redesign.md).

This plan controls implementation semantics. The mockup establishes reading order, density,
relative emphasis, and progressive disclosure. It is a design artifact, not production code.
Its two records are captured catalog data from September 13, 2026. Draft edits are page-local;
placeholder icons stand in for project identity artwork. Navigation decoration is illustrative.
The study does not demonstrate every attention, loading, error, or empty-data state.

The user endorsed the panel direction and requested the companion factsheet and a slightly smaller
commit count. Treat the 520px panel as the proposed default, retain 400px as a density reference,
and verify the usable width against the actual inventory before finalizing the token.

## Reading order and composition

| Information             | Panel                                                             | Factsheet                                                           |
| ----------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| Identity                | Compact mark, name, purpose, intent, visibility, useful links     | Same identity at the top left, with room for purpose                |
| Attention / next action | One prominent item directly after identity                        | Same component at the top right; follows identity on narrow screens |
| Signals                 | Activity default; Reach and Codebase alternate tabs               | Activity/Codebase on the left, Reach alongside on the right         |
| Work                    | Concise issue, PR, and td summary; expand for detail              | Same section under activity                                         |
| Repository / release    | CI, branch, divergence summary; expand for detail                 | Same section under work                                             |
| Stack                   | Relevant technology names and count; expand versions and evidence | Same section under reach                                            |
| Notes / decisions       | Short summary; expand editable decisions                          | Same section below stack                                            |
| All fields / sources    | Searchable inspector, accessible from footer                      | Same inspector and access point                                     |

On narrow screens, use one column and avoid horizontal overflow. Keep identity and priority first,
followed by signals and supporting sections. Maintain a sensible DOM and keyboard reading order;
do not use visual reordering that makes focus jump unpredictably across columns. The factsheet
returns to the inventory with its query, sorting, columns, selected entry, and useful scroll
position intact. Direct factsheet links must also load without first visiting the inventory.

### Identity and attention

- Keep name, short purpose, intent, and source visibility prominent. Put slug, full path, scan
  timestamps, and completeness detail in supporting areas. Copy path only when a path exists.
- Use a compact identity asset with the existing rich viewer available on demand. Preserve
  reduced motion, fallback posters, lifecycle disposal, and other rich fields in the inspector.
- Preserve favorites, hide/show, rename, terminal, repository, website, and palette actions.
  Group infrequent actions in an accessible menu; do not silently remove them to simplify layout.
- Select priority from already-classified attention reasons, using an explicit pure ordering:
  operational failures / blockers, overdue external work / upgrades, then missing decisions.
  Establish stable ties by source and input. Document the exact ranking in the implementation.
  Do not use the incidental array order or raw cached CI state as the ranking contract.
- Show one primary item with its useful action and a `+N more` disclosure when others exist.
  “Why this?” exposes the classified message, observed input, comparison, threshold, and source
  freshness. Preserve all attention memberships and reasons, including positive signals.
- Completeness can refer to any required registered field. Only offer “set next action” when
  that field is actually the relevant missing decision. Existing next actions remain visible.
- When nothing needs attention, show the stored next action or a calm empty state. Do not invent
  a task, a failure, or a composite health score. Stale and unavailable inputs are not healthy zeros.

### Signals and chart semantics

Use the current token palette and existing roc glyphs. Keep flat data surfaces, subtle separators,
and status color for meaning. Introduce documented type/layout tokens in `tokens.css`; the study's
commit count uses **1.6rem**, reduced from 1.85rem, in both layouts. Do not shrink unrelated metric
numbers as a side effect. Respect the established font families, focus states, and reduced motion.

- Activity: commits in 30 days, active days, three comparable rate bars, commits in 7 days,
  merged PRs in 30 days, and contributor context. Label contributor scope accurately.
- Current commit totals are cumulative windows. Derive disjoint rates as
  `(commits90d - commits30d) / 60`, `(commits30d - commits7d) / 23`, and `commits7d / 7`.
  Label them as days 90–31, days 30–8, and last 7 days. Validate missing or inconsistent inputs;
  never draw negative widths or manufacture daily history from these totals.
- Reach: dated star observations and the applicable audience metrics. Private projects suppress
  empty star charts; collected traffic can remain a compact secondary summary. Provider
  unavailability must remain distinct from no activity. Identify the traffic window and capture
  time using the collector's actual semantics, not a generic “30 days” label.
- Codebase: dated LOC observations, file count, and useful size context. LOC is not a productivity,
  quality, or test-coverage score. Do not infer coverage from test-file line counts.
- Space points by date. Label observed ranges when axes do not start at zero. Expose observations
  on hover and keyboard focus; use one Tab stop per chart with arrow keys for individual points.
  Provide text summaries, not color-only interpretation. Label sparse samples and gaps; a
  connecting segment is an interpolation between observations, not a claim of continuous capture.
- Handle no observations, one observation, constant series, missing dates, nulls, and errors
  explicitly. A missing provider should not leave a row of decorative dashes in the overview.

### Progressive detail

Collapsed sections carry useful summaries. Expanded sections expose actionable context and
evidence without repeating every summary. Keep disclosure state and pending edit text stable when
switching signal tabs or updating other data. Bound retained state by project identity so it does
not leak between projects. Do not let background refresh destroy focused edits.

The inspector discovers fields from the registry, including custom and empty fields. Preserve
field labels, descriptions, provider ownership, type-specific editors, source timestamps, errors,
incoming relations, and the generic structured/rich-value fallback. A field not chosen for a
special overview component must still be findable here. Remote-only entries expose source identity
and omit unavailable local actions.

## Existing implementation and intended seams

Current entry pages render `EntryFacts.svelte` through `EntryPage.svelte`. The inventory page
renders that same body inside `Panel.svelte`. `facts.ts` supplies registry-driven field discovery.
These are the starting seams, rather than two fresh implementations.

| Responsibility              | Current source                                                                | Intended change                                                                |
| --------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Panel composition           | `src/routes/(inventory)/+page.svelte`, `src/lib/ui/Panel.svelte`              | Compact project composition in the existing grid column                        |
| Factsheet composition       | `src/lib/ui/EntryPage.svelte`, `src/routes/(inventory)/p/[slug]/+page.svelte` | Wider composition of the same sections                                         |
| Field discovery / rendering | `src/lib/ui/facts.ts`, `EntryFacts.svelte`, `FieldEditor.svelte`              | Shared typed presentation model, reusable sections, generic inspector fallback |
| Classification              | `src/lib/domain/attention.ts`, `completeness.ts`                              | Pure deterministic primary-reason selection over existing classifications      |
| Writes                      | `src/lib/ui/catalog.svelte.ts`, `src/lib/domain/optimistic.ts`                | Reuse validated optimistic edits, rollback, pending state, undo                |
| Rich values                 | `src/lib/ui/RichFieldPreview.svelte`, `rich-field-adapters.ts`                | Compact identity with existing viewer available on demand                      |
| Detail reads                | `src/lib/domain/entry-view.ts`, `src/lib/server/catalog/entries.ts`           | Focused history capability alongside the existing entry contract               |
| Persistence                 | `src/lib/server/catalog/repository.ts`                                        | Reuse `listSnapshots`; no new database or schema for existing series           |

Keep presentation grouping separate from domain classification. A small pure selector should
prepare shared overview data from the entry, registry, and available history; it must not import
Svelte, route state, storage drivers, or deployment profiles. Components own layout and disclosure
state, while the shared catalog owns mutations. Avoid a new plugin or presentation framework.

Project-specific sections must not regress technology factsheets (`/t/<slug>`) or other entry
kinds. Preserve the generic facts rendering path for those kinds until deliberately redesigned.

### Focused history read and surface parity

`EntryView` currently exposes metrics without dated observations. The entry projection reads
snapshots for calculated deltas but does not return those observations. The legacy project catalog
at `GET /api/projects` includes `DashboardProject.snapshots`; `ongoing show` uses that catalog.
There is **no `GET /api/projects/:id`** to reuse. Do not fetch the entire legacy catalog each time
a panel opens or add history for every entry to the initial inventory payload.

Add a narrowly scoped read, proposed as
`GET /api/entries/:kind/:slug/history?metric=github_stars&days=90`, backed by an application function
and `CatalogRepository.listSnapshots`. Validate metric names and a bounded window; return entry
identity, metric, window, ordered dated observations, and explicit availability/freshness metadata.
An unknown entry, unsupported metric/kind, unavailable provider, and empty series must have
documented distinct behavior. Reuse the existing snapshot metric registry rather than a UI list.

Expose the identical contract through the local API transport and a discoverable command, proposed
as `ongoing history <entry> --metric github_stars --days 90 --json`. Keep existing `ongoing show`
output compatible. Document the final verb/endpoint together in `docs/cli.md` and test HTTP/local
equivalence. This is one shared read capability, not a browser-only chart endpoint.

Fetch history lazily for the selected entry and visible signals. Cache by entry, metric, window,
and snapshot freshness; cancel or ignore obsolete responses when selection changes. Render the
overview immediately from loaded entry data, then independent loading/empty/error chart states.
Daily commit history is outside the initial scope; it requires a separate collection contract.

## Delivery sequence

1. **Model and first working panel.** Define priority selection, section presentation data, and
   graceful missing-data behavior. Build identity, attention/next action, aggregate activity,
   disclosures, and the registry inspector in the actual panel. Wire real writes through `Catalog`.
   Prove one edit, failed-save rollback, and undo through the browser and corresponding CLI path.
2. **Shared history and charts.** Add application/repository read, HTTP, local transport, and CLI
   contracts in that order. Connect dated Reach and Codebase charts to the panel with lazy reads,
   race protection, accessibility, and useful loading/error states. Preserve aggregate bars.
3. **Factsheet composition.** Reuse the verified sections on `/p/<slug>`, implement responsive
   placement, preserve inventory navigation state and focused-project palette behavior, and prove
   the same writes and inspector behavior there. Keep technology factsheets working.
4. **Finish and activate.** Update `DESIGN.md`, shared tokens, CLI/API docs, current Fractal claims,
   and QA screenshots. Run focused journeys and required repository checks, obtain independent
   review, repair findings, commit/push, then build/restart through the documented host lifecycle
   and verify real dashboard and factsheet routes. Move this plan to implemented only when shipped.

These are dependency-ordered slices of one redesign, not independent panel and factsheet rewrites.
All four slices have landed on `main`; this plan is the record of what each was required to deliver, and the activation task (`td-c3481c`) deploys them.

## Acceptance evidence

- A reader sees identity, primary attention/next action, and meaningful activity before administrative
  fields. The panel remains usable alongside the inventory at 400px and the proposed 520px width.
- Panel and factsheet show the same facts, priority reason, available actions, values, and errors
  for one project. Wider layout changes composition, not business behavior.
- Cover public/busy, private, dormant, remote-only, missing-on-disk, no-next-action, multiple-reason,
  stale-data, provider-unavailable, and empty-history records. Include a technology factsheet.
- Validate disjoint-rate arithmetic and dated chart domains with independently specified expected
  values. Check constant/sparse series, nulls, and unavailable inputs. Do not test CSS internals.
- Register a custom field and exercise its inspector editor through the shared contract. Preserve
  empty-field discovery, rich viewers, incoming relations, and collector warnings.
- Prove edits, validation errors, pending saves, rollback, undo, and CLI equivalents from both
  layouts. Test selection changes during history reads and edits; no stale response may replace
  another project's chart or discard a draft.
- Exercise keyboard-only navigation, chart arrow controls, focus restoration, dialog dismissal,
  preserved disclosures, reduced motion, light/dark contrast, and a narrow 390px viewport.
- Extend `tests/e2e/inventory.test.ts` and `tests/e2e/screenshots.test.ts` for these journeys. Run
  `bun run lint`, `bun run test`, and `bun run check`, plus focused browser coverage. Regenerate
  screenshots using `QA_SCREENSHOTS=1 E2E_PORT=7801 bun run test:e2e tests/e2e/screenshots.test.ts`.
- Validate the absolute Fractal model directory and re-export affected scenes. For production
  implementation, use `ongoing restart --build` and verify actual inventory and `/p/<slug>` routes;
  preserve production data, disabled LAN auth, immutable build retention, and the default tmux server.

## Design-study completion

- [x] Panel proposal with captured Sidecar and Ongoing records.
- [x] Factsheet proposal reusing the same presentation functions and interactions.
- [x] Commit headline reduced to 1.6rem on both surfaces.
- [x] Durable mockup and proposed architecture references.
- [x] Production implementation and acceptance evidence above (slices 1–4, `td-b04ee9`).

## Implementation completion

- [x] Slice 1 — shared presentation model, priority ranking, and the panel (`td-06b705`).
- [x] Slice 2a — history read: application, repository, HTTP, local transport, CLI, docs (`td-367041`).
- [x] Slice 2b — dated Reach and Codebase charts with lazy, race-safe reads (`td-6e533a`).
- [x] Slice 3 — fact sheet composition on `/p/<slug>` with return state (`td-9fd8f3`).
- [x] Slice 4 — `DESIGN.md` token and component tables, current Fractal claims and exports, QA
      screenshots at 520px, 400px, fact sheet, 390px, light and dark, full gates (`td-a93b61`).
- [ ] Activation — `ongoing restart --build`, verify inventory and `/p/<slug>` in production, move
      this plan to `docs/plans/implemented/` (`td-c3481c`).

## Changelog

- 2026-09-14 — Slice 4 (`td-a93b61`, branch `pd-finish`): `DESIGN.md` documents the new type,
  tracking, rule, panel, fact-sheet, overview, chart, and floating-surface tokens, the eighteen
  `src/lib/ui/project/` components, the five rules they render (documented priority tiers,
  disjoint rates, dated-chart semantics, colour as status, edits through `Catalog`), the pure
  modules, and the chart keys. `docs/cli.md` already documented `ongoing history` and its endpoint
  together (slice 2a); nothing to add. The Fractal `project-detail-redesign` scene is current:
  the subsystem is retitled "Project overview", every element cites shipped modules, a "Dated
  charts" element joins the four, and eleven connections tie it to the catalog repository,
  attention rules, registry, entries API, CLI verbs, optimistic edits, design system, shell,
  entry page, and URL state; the history read joins the same-HTTP-contract boundary and the
  overview model the pure-rules boundary. Ten affected scenes re-exported; `overview.png` was an
  SVG under the wrong extension and is now a real PNG. `tests/e2e/screenshots.test.ts` takes a
  per-screen viewport and the record gained the 400px panel (1280 viewport), the panel and fact
  sheet at 390px, and the field inspector, in both themes. Full gates on the merged candidate
  are recorded in `td-a93b61`.
- 2026-09-14 — Slice 3 (`td-9fd8f3`, branch `pd-factsheet`): `ProjectFactsheet.svelte` composes
  the panel's sections wider on `/p/<slug>`: identity and priority side by side, then two
  contiguous DOM groups — Activity/Codebase (`ProjectSignals` restricted to those two tabs via a
  new `tabs` prop) with Work and Repository on the left, the new `ReachSection` (Reach always
  visible rather than behind a tab) with Stack and Notes on the right — so a narrow screen
  collapses to one column in that same order. `ProjectIdentity` gained a `headingLevel` prop so
  the fact sheet's name is the page's own `<h1>`. `project/menu.ts` shares the actions-menu and
  copy-path logic between the panel and the fact sheet. The inventory's fact-sheet links carry
  `?from=` (the exact return URL) and `scroll-memory.ts` remembers the list's scroll position
  under it, so the fact sheet returns to the same query, sort, columns, selected entry, and scroll
  position; a direct `/p/<slug>` link still loads without it. Technology fact sheets are
  unchanged — `EntryPage.svelte` branches on kind before composing anything project-specific.
- 2026-09-14 — Slice 2b (`td-6e533a`, branch `pd-charts`): dated Reach and Codebase charts fill
  the `ProjectSignals` snippet slots. `ui/chart.ts` owns domain, ticks, gap detection, and text
  summaries; `ui/history-client.ts` lazily reads `GET /api/entries/:kind/:slug/history` and caches
  by entry, metric, window, and collector freshness. Keyboard: one Tab stop per chart, arrows
  between points. Private repos still suppress the star chart; unavailable collection is copy, not
  dashes.
- 2026-09-14 — Slice 1 (`td-06b705`, branch `pd-panel`): `domain/priority.ts` documents the
  five-tier ranking; `ui/overview.ts` is the shared presentation model; `ui/project/*` renders the
  panel with identity, priority, aggregate activity, Reach/Codebase tabs (chart snippet slots left
  for slice 2), disclosures, actions menu, and the registry inspector. Panel token 520px, compact
  400px under 1366px. Website link derives from a registered `url` field until the entry contract
  carries `website_json`.
- 2026-09-14 — Activation (`td-c3481c`): full gates on merged `main` (lint, check, 486 unit tests,
  33 e2e passed / 25 gated skips), `ongoing restart --build`, and live verification of `/`,
  `/?entry=sidecar`, `/p/sidecar`, `/t/typescript`, the history endpoint, and `ongoing history`
  over both transports (identical output). Plan moved to implemented.
