/** MITRE ATT&CK helpers: tag classification and link building. */

/** Sigma tag slug -> ATT&CK tactic display name. */
export const TACTIC_NAMES: Record<string, string> = {
  reconnaissance: 'Reconnaissance',
  'resource-development': 'Resource Development',
  'initial-access': 'Initial Access',
  execution: 'Execution',
  persistence: 'Persistence',
  'privilege-escalation': 'Privilege Escalation',
  'defense-evasion': 'Defense Evasion',
  // ATT&CK v19 successors of defense-evasion; Sigma tags may use either generation
  'defense-impairment': 'Defense Impairment',
  stealth: 'Stealth',
  'credential-access': 'Credential Access',
  discovery: 'Discovery',
  'lateral-movement': 'Lateral Movement',
  collection: 'Collection',
  'command-and-control': 'Command and Control',
  exfiltration: 'Exfiltration',
  impact: 'Impact',
};

const TECHNIQUE_RE = /^t\d{4}$/i;
const SUB_TECHNIQUE_RE = /^t\d{4}\.\d{3}$/i;

export interface MitreExtraction {
  tactics: string[];
  techniques: string[];
  subTechniques: string[];
  /** Tags that are not ATT&CK-related (everything except attack.*). */
  otherTags: string[];
}

/** Split Sigma tags into ATT&CK tactics/techniques/sub-techniques and everything else. */
export function extractMitre(tags: string[]): MitreExtraction {
  const tactics = new Set<string>();
  const techniques = new Set<string>();
  const subTechniques = new Set<string>();
  const otherTags: string[] = [];

  for (const tag of tags) {
    const normalized = tag.trim();
    if (!normalized.toLowerCase().startsWith('attack.')) {
      otherTags.push(normalized);
      continue;
    }
    const value = normalized.slice('attack.'.length).toLowerCase();
    if (SUB_TECHNIQUE_RE.test(value)) {
      subTechniques.add(value.toUpperCase());
      techniques.add(value.toUpperCase().split('.')[0]!);
    } else if (TECHNIQUE_RE.test(value)) {
      techniques.add(value.toUpperCase());
    } else if (value in TACTIC_NAMES) {
      tactics.add(value);
    }
    // Other attack.* tags (groups g0001, software s0005, ...) are intentionally
    // kept out of the tactic/technique lists but not treated as generic tags.
  }

  return {
    tactics: [...tactics],
    techniques: [...techniques],
    subTechniques: [...subTechniques],
    otherTags,
  };
}

export function isAttackTag(tag: string): boolean {
  return tag.trim().toLowerCase().startsWith('attack.');
}

/** Link to attack.mitre.org for a technique or sub-technique ID like T1059 or T1059.001. */
export function mitreTechniqueUrl(id: string): string {
  const [base, sub] = id.toUpperCase().split('.');
  return sub
    ? `https://attack.mitre.org/techniques/${base}/${sub}/`
    : `https://attack.mitre.org/techniques/${base}/`;
}

export function tacticDisplayName(slug: string): string {
  return TACTIC_NAMES[slug] ?? slug;
}
