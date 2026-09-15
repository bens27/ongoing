# Contributing

Ongoing is a CLI-first inventory: every owned capability needs a deterministic
non-interactive path (`bin/ongoing … --json`) before it gets a button. The browser,
also reachable through the same HTTP contract, is a projection of that core — never a
privileged path.

## Gates

`.bun-version` is the only place the Bun version is written down. Before pushing, run
what CI runs:

```sh
bun install --frozen-lockfile
bun run lint
bun run test
bun run check
bun run build
QA_SCREENSHOTS=1 E2E_PORT=7801 bun run test:e2e tests/e2e/screenshots.test.ts
```

`bun run test:e2e` is the full Playwright suite (Chromium); the last line regenerates
the UI screenshots in `docs/qa/screens/` that the README references.

## Conventions

- Behavior changes come with tests beside them; boundary tests live next to the
  constants they pin (`ATTENTION_THRESHOLDS` and its suite are the reference shape).
- CLI changes update [docs/cli.md](docs/cli.md); new surfaces answer `--json` as well
  as human-readable output.
- The catalog is `entries`, `entry_sources`, `fields`, `relations`, `saved_views`.
  Register a field for per-entry values; do not add a column. All reads use the query
  grammar in `src/lib/domain/query.ts`.
- Logo support (`identity.logo`, `ongoing logos export`) needs the private
  `@impressions/logo` overlay, which is intentionally not a dependency
  (see `src/lib/logo-overlay.d.ts`). The export test runs only where the overlay is
  installed; everything else must pass without it.
- `deploy/<name>/` holds machine-specific deployment profiles. The core never imports
  them; another machine writes its own profile beside the author's `deploy/aerie/`.
