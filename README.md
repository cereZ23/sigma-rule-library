# Sigma Rule Library

**Live site: <https://cerez23.github.io/sigma-rule-library/>**

A fast, fully static web interface for exploring the community-maintained
[Sigma](https://github.com/SigmaHQ/sigma) detection rules: search, filter by
platform / log source / severity / MITRE ATT&CK, read the detection logic, and
copy or download the original YAML.

> Sigma Rule Library is an independent community interface for exploring rules
> from the SigmaHQ repository. It is not affiliated with or endorsed by SigmaHQ.

![Screenshot placeholder — library page with search and filters](docs/screenshot-library.png)

## Features

- **Full catalog import**: ~3,800 rules from `rules/`, `rules-threat-hunting/`,
  `rules-emerging-threats/`, `rules-compliance/` and `rules-placeholder/`
  (configurable in `config/sigma-sources.ts`).
- **Instant client-side search** across title, description, ID, authors, tags,
  ATT&CK technique IDs, log source and detection values — with combinable
  filters, live counts, sorting, pagination and shareable URLs
  (`/library?q=powershell&product=windows&level=high`).
- **A static page per rule**: metadata, log source, ATT&CK mapping, structured
  detection view, raw YAML (verbatim, highlighted, with line numbers), false
  positives, references, related and similar rules, plus Copy / Download /
  Share / GitHub actions.
- **MITRE ATT&CK coverage page**: every enterprise tactic and technique with
  the number of rules covering it (0 / 1 / n highlighted).
- **Statistics page**: distributions by level, status, product, category,
  section, author, technique and year, plus the import error report.
- **Daily automatic sync** with SigmaHQ via GitHub Actions; rebuilds only when
  the upstream commit changes.
- Dark/light mode, responsive layout, WCAG 2.1 AA-oriented markup, no backend,
  no analytics, no cookies.

## Architecture

```
SigmaHQ/sigma (shallow clone, build time)
        │  scripts/fetch-sigma.ts
        ▼
.cache/sigma ──▶ scripts/parse-sigma.ts ──▶ src/generated/rules.json
        │                                   src/generated/import-errors.json
        │        scripts/generate-stats.ts  src/generated/stats.json
        │        scripts/build-search-index.ts  src/generated/library-index.json
        │        scripts/validate-generated-data.ts  (schema + thresholds gate)
        ▼
Astro static build ──▶ dist/  (one page per rule + library/mitre/statistics)
```

Key decisions (see `docs/SPEC.md` for the full specification):

- **Astro 7 + Tailwind CSS 4**, TypeScript strict, no client-side framework.
  The only substantial client JavaScript is the library search app
  (`src/scripts/library-app.ts`), which consumes a compact prebuilt JSON index.
- **Search**: a custom JSON index (not Pagefind) so that free-text search,
  faceted filter counts, sorting and URL state share one small, testable code
  path (`src/lib/search.ts`, `src/lib/filters.ts`).
- **Slugs**: the Sigma UUID when present (`/rules/<uuid>/`), otherwise
  `<title-slug>-<path-hash>` — URLs stay stable across catalog updates.
- **Parser resilience**: a malformed upstream file never breaks the build; it
  is recorded in `import-errors.json` (browsable on the Statistics page). CI
  fails only if *zero* rules import or the error rate exceeds
  `SIGMA_MAX_ERROR_RATE` (default 5%).
- **Untrusted content**: rule YAML is data, never code. Everything renders
  escaped, reference links are protocol-validated, and a CSP meta tag limits
  scripts to same-origin bundles.
- **ATT&CK matrix**: a trimmed snapshot of the enterprise STIX bundle is
  vendored at `src/data/attack-matrix.json` so the coverage page can show
  techniques with zero rules (see CONTRIBUTING for the refresh command).

## Requirements

- Node.js ≥ 20 (CI uses 22)
- git (for the shallow clone of SigmaHQ/sigma)

## Local development

```bash
npm install
npm run dev        # first run automatically fetches + parses the catalog
```

The first `npm run dev`/`npm run build` triggers the data pipeline (about a
minute, mostly the SigmaHQ clone). To refresh the catalog later:

```bash
npm run data:fetch -- --force   # update the cached clone
npm run data                    # re-run the full pipeline
```

## Build and test

```bash
npm test           # Vitest unit tests (parser, slugs, filters, URLs, security)
npm run check      # astro check (TypeScript)
npm run build      # static site into dist/
npm run preview    # serve dist/ locally
```

## GitHub Pages configuration

The site works at a domain root **and** as a project page. Configuration comes
from environment variables (locally via `.env`, see `.env.example`):

| Variable                   | Example                          | Purpose                       |
| -------------------------- | -------------------------------- | ----------------------------- |
| `PUBLIC_SITE_URL`          | `https://username.github.io`     | Origin used for canonical URLs, sitemap, robots.txt |
| `PUBLIC_BASE_PATH`         | `/sigma-rule-library` (or empty) | Base path of the deployment   |
| `PUBLIC_GITHUB_REPOSITORY` | `username/sigma-rule-library`    | "Site source code" links      |

To enable deployment:

1. Push this repository to GitHub (default branch `main`).
2. Repository **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push to `main` (or run the *Deploy to GitHub Pages* workflow manually).
   In CI the variables above are derived automatically from the repository
   name; override them with repository **Variables** of the same names if
   needed (e.g. custom domain).

## Automatic sync with SigmaHQ

`.github/workflows/sync-sigma.yml` runs daily (03:17 UTC): it compares the
latest SigmaHQ commit with the `source-metadata.json` published by the deployed
site and triggers a full rebuild only when they differ. The job summary shows
imported rule counts, parse errors and duplicates. Generated data is never
committed — it is rebuilt on every deploy.

## Data files

| File (generated)                    | Content                                        |
| ----------------------------------- | ---------------------------------------------- |
| `src/generated/rules.json`          | Full catalog (build-time only, includes raw YAML) |
| `src/generated/library-index.json`  | Compact client-side search index               |
| `src/generated/stats.json`          | Aggregate statistics                           |
| `src/generated/import-errors.json`  | Files that failed to import, duplicates        |
| `src/generated/source-metadata.json`| Source repo, branch, commit, sync timestamp (also copied to `public/`) |

## Troubleshooting

- **`missing .cache/sigma`** — run `npm run data:fetch` (needs network + git).
- **Stale catalog locally** — `npm run data:fetch -- --force && npm run data`.
- **Broken styles/links under GitHub Pages** — check `PUBLIC_BASE_PATH`
  matches the repository name (leading slash, no trailing slash).
- **CI fails with "parse error rate exceeds threshold"** — inspect
  `import-errors.json` in the workflow summary; raise `SIGMA_MAX_ERROR_RATE`
  only if the upstream breakage is expected.

## Security

See [SECURITY.md](SECURITY.md). In short: static site, no backend, rule
content treated strictly as untrusted data.

## License and attribution

- Site code: [MIT](LICENSE).
- Sigma rules: property of their respective authors, licensed under the
  [Detection Rule License](https://github.com/SigmaHQ/sigma/blob/master/LICENSE.Detection.Rules.md)
  of the SigmaHQ repository. The source commit used for the current catalog is
  shown in the footer and on the About page.
- MITRE ATT&CK® is a registered trademark of The MITRE Corporation.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Rule content fixes belong upstream in
[SigmaHQ/sigma](https://github.com/SigmaHQ/sigma).
