# Security Policy

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub Security Advisories
("Report a vulnerability" on the repository's Security tab). Do not open a
public issue for security reports.

## Scope and threat model

This is a fully static site with no backend, no authentication and no user
data. The main security concern is that all rule content comes from an
external repository (SigmaHQ/sigma) and is treated as **untrusted data**:

- Rule YAML is parsed at build time and never executed.
- All rule-derived text is rendered escaped; `innerHTML` is never used with
  rule content (the client-side library renders via `textContent` only).
- External reference URLs are validated: only `http:`/`https:` links are
  rendered as anchors, anything else (e.g. `javascript:`) is shown as inert
  text (`src/lib/security.ts`).
- A Content Security Policy (meta tag, as GitHub Pages cannot set headers)
  restricts scripts to same-origin bundles.
- GitHub Actions workflows run with minimal permissions and no write-scoped
  tokens; the deploy uses the official OIDC-based Pages actions.

Issues in the Sigma rules themselves (detection quality, false positives)
belong upstream in [SigmaHQ/sigma](https://github.com/SigmaHQ/sigma).
