# Changelog

All notable changes to Ongoing are documented here.

## [Unreleased]

- **First public release.** Ongoing was developed privately; the public history starts
  here as a single commit, with the private archive kept by the author. The tree itself
  is unchanged apart from the open-source preparation below.
- **Private logo overlay.** The `@impressions/logo` artwork tooling is the author's own
  and is not published: it left `dependencies` and `vendor/`, and every import site
  degrades gracefully without it. Logo validation falls back to a structural check,
  the viewer falls back to the poster, and only `logos export` requires the overlay.
- **One default port.** The CLI talked to `127.0.0.1:7766` while `serve` listened on
  `4173`; both default to `4173` now, and `ongoing --version` reads `package.json` so
  the two can never drift again.
- **Docs for strangers.** Real clone URL, matching `~/code` scan roots, light/dark
  README screenshots, `CONTRIBUTING.md`, `SECURITY.md`, and synthetic mockup fixtures.

## [0.1.0] - 2026-09-15

Initial public release under the MIT license.
