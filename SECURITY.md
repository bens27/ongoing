# Security

Ongoing is built for **one trusted user on a private network**. `serve` binds loopback
unless `HOST` says otherwise, and a non-loopback listener refuses to start without
`ONGOING_ACCESS_SECRET` (see [docs/auth.md](docs/auth.md)). `ONGOING_DISABLE_AUTH=true`
is a trusted-LAN escape hatch, not a default. Do not put it on the public internet.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting on this repository. Include the transport
in use (`auto`, `http`, or `local`), whether the listener is loopback or LAN, and the
smallest reproduction you have. There is no bug bounty; reports are handled by the
maintainer as time allows.

## Supported versions

Only the latest `0.x` release receives security fixes.
