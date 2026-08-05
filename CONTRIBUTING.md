# Contributing

Thanks for your interest in improving Sigma Rule Library!

## What belongs here — and what doesn't

- **This repository**: the website (parsing pipeline, UI, search, CI).
- **Not this repository**: the detection rules themselves. Rule fixes and new
  rules belong upstream in [SigmaHQ/sigma](https://github.com/SigmaHQ/sigma);
  this site re-imports them automatically every day.

## Development setup

Requirements: Node.js ≥ 20 and git.

```bash
npm install
npm run data     # shallow-clones SigmaHQ/sigma into .cache/ and builds the catalog
npm run dev      # dev server (runs the data pipeline automatically if needed)
```

Useful scripts:

| Command                    | Purpose                                              |
| -------------------------- | ---------------------------------------------------- |
| `npm run data`             | Full pipeline: fetch → parse → stats → index → validate |
| `npm run data:fetch -- --force` | Refresh the cached SigmaHQ clone                |
| `npm test`                 | Unit tests (Vitest)                                  |
| `npm run check`            | Type checking (`astro check`)                        |
| `npm run build`            | Full static build into `dist/`                       |
| `npm run preview`          | Serve the built site locally                         |

## Before opening a PR

1. `npm test`, `npm run check` and `npm run build` must all pass.
2. Keep the constraints from `docs/SPEC.md` in mind — in particular: rule
   content is untrusted (never `innerHTML`), every internal link must go
   through the base-path helpers in `src/lib/urls.ts`/`src/lib/site.ts`, and a
   malformed upstream rule file must never break the build.
3. Add or update unit tests for parser/filter/URL logic changes.

## Refreshing the vendored ATT&CK matrix

`src/data/attack-matrix.json` is a trimmed snapshot of the enterprise ATT&CK
STIX bundle. To update it:

```bash
curl -L -o /tmp/enterprise-attack.json \
  https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack.json
npx tsx scripts/build-attack-matrix.ts /tmp/enterprise-attack.json
```
