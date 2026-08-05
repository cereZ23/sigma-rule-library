/**
 * Which sections of the SigmaHQ/sigma repository are imported into the catalog.
 * Flip a flag to include/exclude a section at the next `npm run data` run (SPEC §3).
 */
export const sigmaSources = {
  standard: true,
  threatHunting: true,
  emergingThreats: true,
  compliance: true,
  placeholder: true,
  dfir: false,
  deprecated: false,
  unsupported: false,
} as const;

export type SigmaSourceKey = keyof typeof sigmaSources;

/** Repository directory and human-readable label for each source section. */
export const sourceSections: Record<SigmaSourceKey, { dir: string; label: string }> = {
  standard: { dir: 'rules', label: 'Core Rules' },
  threatHunting: { dir: 'rules-threat-hunting', label: 'Threat Hunting' },
  emergingThreats: { dir: 'rules-emerging-threats', label: 'Emerging Threats' },
  compliance: { dir: 'rules-compliance', label: 'Compliance' },
  placeholder: { dir: 'rules-placeholder', label: 'Placeholder' },
  dfir: { dir: 'rules-dfir', label: 'DFIR' },
  deprecated: { dir: 'deprecated', label: 'Deprecated' },
  unsupported: { dir: 'unsupported', label: 'Unsupported' },
};

export const SIGMA_REPO = process.env.SIGMA_REPO ?? 'SigmaHQ/sigma';
export const SIGMA_BRANCH = process.env.SIGMA_BRANCH ?? 'master';
export const SIGMA_CACHE_DIR = '.cache/sigma';

/** Maximum tolerated share of files that fail to parse before CI fails (SPEC §19). */
export const MAX_ERROR_RATE = Number(process.env.SIGMA_MAX_ERROR_RATE ?? '0.05');
