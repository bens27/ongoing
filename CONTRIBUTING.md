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

## Commit messages

New commits use `type(scope optional): concise imperative summary`. For example:

```text
feat: add saved views
fix(cli): handle missing entries
refactor(api)!: remove the legacy route
```

Allowed lowercase types are `feat`, `fix`, `docs`, `style`, `refactor`, `perf`,
`test`, `build`, `ci`, `chore`, and `revert`. Optional scopes start with a lowercase
letter or digit and contain lowercase letters, digits, dots, underscores, slashes,
or hyphens. An optional `!` before the colon marks a breaking change. Use exactly
one space after the colon and a nonempty summary without leading or trailing
whitespace. Keep summaries concise and imperative (for example, “add” rather than
“added”); those prose qualities are reviewed by people, not inferred by the checker.

Bodies and trailers are optional and unrestricted by the checker. Nightshift task
commits must include separate `Nightshift-Task` and `Nightshift-Ref` trailers, using
the assigned task identifier and the Nightshift repository URL:

```text
chore: standardize commit message format

Validate new PR commits without changing existing history.

Nightshift-Task: commit-normalize
Nightshift-Ref: https://github.com/marcus/nightshift
```

Run `bun run check:commits '<base>..<head>'` to check an explicit two-dot Git range.
For a branch targeting main:

```sh
git fetch origin main
base=$(git merge-base origin/main HEAD)
bun run check:commits "$base..HEAD"
```

PR CI checks commits introduced since the merge base with the target branch.
Actual merge commits (multiple parents) and Git-generated `Revert "..."` subjects
are exempt. Ordinary commits with a `Merge` prefix are not exempt. Enforcement is
prospective: existing history is not rewritten, and messages, bodies, and trailers
are never automatically modified.
