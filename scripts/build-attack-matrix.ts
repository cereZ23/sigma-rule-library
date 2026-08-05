/**
 * One-off helper: trim a MITRE ATT&CK enterprise STIX bundle down to the
 * compact matrix committed at src/data/attack-matrix.json, used by the
 * /mitre coverage page. Re-run to refresh against a newer ATT&CK release:
 *
 *   curl -L -o /tmp/enterprise-attack.json \
 *     https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack.json
 *   npx tsx scripts/build-attack-matrix.ts /tmp/enterprise-attack.json
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PROJECT_ROOT, writeJson } from './util';

interface StixObject {
  type: string;
  name?: string;
  revoked?: boolean;
  x_mitre_deprecated?: boolean;
  x_mitre_is_subtechnique?: boolean;
  x_mitre_shortname?: string;
  x_mitre_version?: string;
  kill_chain_phases?: { kill_chain_name: string; phase_name: string }[];
  external_references?: { source_name: string; external_id?: string }[];
}

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('usage: tsx scripts/build-attack-matrix.ts <enterprise-attack.json>');
  process.exit(1);
}

const bundle = JSON.parse(readFileSync(inputPath, 'utf8')) as { objects: StixObject[] };

const attackId = (obj: StixObject): string | undefined =>
  obj.external_references?.find((ref) => ref.source_name === 'mitre-attack')?.external_id;

const active = (obj: StixObject): boolean => !obj.revoked && !obj.x_mitre_deprecated;

// ATT&CK content version, from the x-mitre-collection object
const version =
  bundle.objects.find((obj) => obj.type === 'x-mitre-collection')?.x_mitre_version ?? 'unknown';

// Tactics keep the canonical matrix order of the bundle
const tacticsRaw = bundle.objects.filter((obj) => obj.type === 'x-mitre-tactic' && active(obj));

const techniques = bundle.objects.filter((obj) => obj.type === 'attack-pattern' && active(obj));

interface MatrixSubTechnique {
  id: string;
  name: string;
}
interface MatrixTechnique {
  id: string;
  name: string;
  subTechniques: MatrixSubTechnique[];
}
interface MatrixTactic {
  slug: string;
  name: string;
  techniques: MatrixTechnique[];
}

const byBaseId = new Map<string, MatrixTechnique>();
for (const tech of techniques) {
  const id = attackId(tech);
  if (!id || tech.x_mitre_is_subtechnique) continue;
  byBaseId.set(id, { id, name: tech.name ?? id, subTechniques: [] });
}
for (const tech of techniques) {
  const id = attackId(tech);
  if (!id || !tech.x_mitre_is_subtechnique) continue;
  const parent = byBaseId.get(id.split('.')[0]!);
  parent?.subTechniques.push({ id, name: tech.name ?? id });
}
for (const tech of byBaseId.values()) {
  tech.subTechniques.sort((a, b) => a.id.localeCompare(b.id));
}

const tactics: MatrixTactic[] = tacticsRaw.map((tactic) => {
  const slug = tactic.x_mitre_shortname ?? '';
  const list = [...byBaseId.values()]
    .filter((tech) => {
      const source = techniques.find((o) => attackId(o) === tech.id && !o.x_mitre_is_subtechnique);
      return source?.kill_chain_phases?.some(
        (phase) => phase.kill_chain_name === 'mitre-attack' && phase.phase_name === slug,
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  return { slug, name: tactic.name ?? slug, techniques: list };
});

const output = {
  source: 'https://github.com/mitre-attack/attack-stix-data (enterprise-attack)',
  version,
  generatedAt: new Date().toISOString(),
  tactics,
};

const outPath = resolve(PROJECT_ROOT, 'src/data/attack-matrix.json');
writeJson(outPath, output, false);
console.log(
  `[build-attack-matrix] ATT&CK v${version}: ${tactics.length} tactics, ` +
    `${byBaseId.size} techniques -> ${outPath}`,
);
