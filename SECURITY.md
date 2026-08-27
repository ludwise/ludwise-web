# Security Policy

## Reporting a vulnerability

**Do not open a public issue for a security vulnerability.** A public report
starts a race between everyone who reads it and the fix.

Email **git@danielkindl.dev** with `SECURITY` in the subject line.

> This is a personal address rather than a dedicated security contact. Replacing
> it with an alias, or enabling GitHub private vulnerability reporting, is
> tracked as remaining setup.

Please include:

- What the vulnerability is, and what an attacker could achieve with it
- Steps to reproduce, or a proof of concept
- The affected version, environment and URL
- Any reference ID from the `x-request-id` response header
- Whether you believe it is already being exploited

### What to expect

This project is maintained by one person, so there is no staffed response rota
and no guaranteed response time. In practice: an acknowledgement when the report
is read, an assessment of severity and a plan once it has been reproduced,
progress updates while a fix is in preparation, and credit for the reporter
unless anonymity is preferred.

If you do not hear back within a couple of weeks, send a follow-up — a missed
message is far more likely than a deliberate silence.

### Please do not

- Access, modify or delete data that is not yours
- Degrade the service for other people, including through automated scanning
- Use social engineering, phishing or physical attacks
- Publish details before a fix is available

Testing against your own local deployment is always fine and is the preferred
way to develop a proof of concept.

## Supported versions

The project is pre-1.0 and not yet deployed to production. Only the current
`production` branch is supported. There are no maintained release branches and
no backports.

## Scope

**In scope:** this repository, and the `ludwise.com` and `staging.ludwise.com`
deployments of it once they exist.

**Out of scope:** the LUDWISE backend is a separate, private repository and is
not published here. A finding in the backend reached _through_ this site is
firmly in scope and worth reporting — a finding you inferred about the backend
in isolation is better reported the same way, and will be routed.

Also out of scope: vulnerabilities in Cloudflare, GitHub or third-party services
themselves, findings requiring a compromised developer machine, and reports
produced solely by an automated scanner with no demonstrated impact.

## What this repository can and cannot reach

Worth stating, because it changes what a finding here can mean.

This Worker has **no database binding, no provider credentials and no secrets**.
It reaches the backend over a Cloudflare service binding, through a client that
exposes three named read operations and accepts no caller-supplied path. There
is no generic proxy and there must never be one: the backend has no public
hostname, so a proxy here would be the only route to a service that is otherwise
unreachable from the internet.

Those properties are enforced by
[`tests/architecture/boundaries.test.ts`](tests/architecture/boundaries.test.ts)
rather than by review. If you find a way around any of them, that itself is the
vulnerability and is worth reporting even without a further exploit.

The service binding **bypasses Cloudflare Access**, which is why the backend
performs its own authorization for operator surfaces rather than relying on the
edge.

## Security posture

Some limitations are worth stating plainly rather than implying protections that
do not exist:

- **Response headers** are set on every Worker response:
  `x-content-type-options`, `x-frame-options`, `referrer-policy`,
  `permissions-policy`, and a Content-Security-Policy covering
  `frame-ancestors`, `base-uri`, `object-src` and `form-action`.
- **`script-src` is deliberately absent** from that policy. Doing it properly
  needs nonces or hashes for the pre-paint theme script and for Astro's island
  hydration, and a policy containing `unsafe-inline` is a policy that says
  nothing. Shipping one that only looked strict would be worse than shipping
  none. This is tracked, and it is the most valuable open hardening item.
- **Staging is private** behind Cloudflare Access, and additionally sends
  `x-robots-tag: noindex` and a `robots.txt` that disallows everything. Those
  last two are defense in depth and never the defense.
- **GitHub Actions are pinned to commit SHAs**, and the set that may run is an
  organization-wide allowlist. The default `GITHUB_TOKEN` is read-only.
- **No third-party scripts, analytics vendors, fonts or trackers.** Fonts are
  self-hosted. There is no runtime third-party origin at all, and a CI check
  fails if one appears.

## Handling secrets

There are none in this repository, which is the point rather than a claim: it is
public, so a committed secret could not be unpublished. `tests/architecture/`
fails the build on anything matching a credential shape, `.gitignore` covers
`.env` and `.dev.vars`, and the deployment needs no secret beyond a Cloudflare
API token held in GitHub Actions.

If you believe something in the history is a secret, report it privately rather
than opening an issue.
