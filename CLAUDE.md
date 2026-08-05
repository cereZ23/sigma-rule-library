# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Sigma Rule Library** — a fully static Astro site (GitHub Pages) that indexes ~3,800 Sigma detection rules from https://github.com/SigmaHQ/sigma. The authoritative specification is `docs/SPEC.md` (Italian); consult it before changing behavior — it defines binding constraints, and §24 is the Definition of Done checklist.

## Commands

```bash
npm run data              # full pipeline: fetch → parse → stats → index → validate
npm run data:fetch -- --force   # refresh the cached SigmaHQ shallow clone (.cache/sigma)
npm run dev / npm run build     # both auto-run the pipeline first if src/generated/ is missing
npm test                  # Vitest unit suite (tests/*.test.ts)
npx vitest run tests/parser.test.ts        # single test file
npm run check             # astro check (TypeScript strict)
npm run preview           # serve dist/ (respects PUBLIC_BASE_PATH)
```

The pipeline needs network + git the first time (shallow-clones SigmaHQ/sigma). Generated JSON in `src/generated/` and `public/source-metadata.json` are gitignored, always rebuilt.

## Architecture

**Build-time data pipeline** (`scripts/`, run with tsx, orchestrated by `npm run data`): `fetch-sigma.ts` (shallow clone + source-metadata.json) → `parse-sigma.ts` (walks sections enabled in `config/sigma-sources.ts`, emits `rules.json` + `import-errors.json`) → `generate-stats.ts` → `build-search-index.ts` (compact `library-index.json` for the client — never contains rawYaml/detection) → `validate-generated-data.ts` (zod schemas + thresholds; the CI gate).

**Pure logic lives in `src/lib/`** and is what the unit tests cover: `sigma.ts` (YAML→SigmaRule parsing, core schema so dates stay strings), `slug.ts` (UUID or title+path-hash slugs), `mitre.ts` (attack.* tag extraction), `filters.ts`/`search.ts` (library filtering/sorting/URL state — shared verbatim between the client app and tests), `urls.ts` (base-path helpers), `security.ts` (URL validation), `similar.ts` (build-time similar-rules via inverted indexes). Scripts and `.astro` files are thin wrappers around these.

**Pages**: `src/pages/rules/[slug].astro` generates one page per rule via `getStaticPaths` over `rules.json`. `library.astro` is a static shell driven by `src/scripts/library-app.ts`, which fetches the JSON index (imported with `?url`). `mitre.astro` crosses rule technique counts with the vendored ATT&CK matrix `src/data/attack-matrix.json` (refresh via `scripts/build-attack-matrix.ts`, see CONTRIBUTING).

**CI**: `deploy.yml` (push to main; also `workflow_call`-able) derives `PUBLIC_*` vars from the repo name unless repository Variables override them. `sync-sigma.yml` (daily cron) compares upstream HEAD against the deployed `source-metadata.json` and reuses deploy.yml only when it changed.

## Binding constraints (from docs/SPEC.md)

- **Rule content is untrusted data** (§16): never execute it, never `innerHTML` it. The library app renders exclusively via `createElement`/`textContent`. Reference URLs must pass `isSafeExternalUrl` (http/https only) before becoming links.
- **CSP is `script-src 'self'`** (meta tag in BaseLayout): every `<script>` must end up as an external bundle. `vite.build.assetsInlineLimit: 0` in astro.config.mjs enforces this — Astro would otherwise inline small scripts and the CSP would silently break them. Site-wide button behaviors live in `src/scripts/site-interactions.ts` (event delegation), loaded once from BaseLayout; don't add per-component `<script>` blocks with no imports.
- **Base path** (§14): the site must work at domain root AND as project page. Every internal href/asset goes through `href()`/`canonical()` from `src/lib/site.ts` (Astro) or `joinBase()` from `src/lib/urls.ts` (pure). Never hardcode absolute paths.
- **Parser resilience** (§4): a malformed upstream file must never fail the build — record it in import-errors.json and continue. CI fails only on zero imports or error rate > `SIGMA_MAX_ERROR_RATE` (default 5%).
- **Raw YAML is shown verbatim** — Copy/Download read `textContent` of the Shiki-rendered block, which preserves the original bytes.
- Repo root is case-insensitive APFS: the spec lives at `docs/SPEC.md` precisely because `README.md`/`readme.md` collide — don't recreate `readme.md`.

## Gotchas

- ATT&CK v19 replaced the defense-evasion tactic with defense-impairment + stealth; `TACTIC_NAMES` in `src/lib/mitre.ts` keeps all three because Sigma tags use both generations.
- `library-index.json` is ~5 MB raw / ~1.1 MB gzipped; anything added to `LibraryRecord` multiplies by 3,800 records — keep it lean.
- Full build is fast (~10 s for ~3,800 pages); there is no need to subset data during development.
