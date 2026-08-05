/**
 * "Similar rules" computed at build time from shared MITRE techniques,
 * logsource and tags (SPEC §8 — deliberately no AI/embeddings).
 * Uses inverted indexes so building similarity for the whole catalog
 * stays far away from O(n²).
 */
import type { SigmaRule } from './sigma';

export interface SimilarRule {
  slug: string;
  title: string;
  level?: string;
  product?: string;
  reason: string;
}

export interface SimilarityIndex {
  byTechnique: Map<string, number[]>;
  byProduct: Map<string, number[]>;
  byCategory: Map<string, number[]>;
  rules: SigmaRule[];
}

export function buildSimilarityIndex(rules: SigmaRule[]): SimilarityIndex {
  const byTechnique = new Map<string, number[]>();
  const byProduct = new Map<string, number[]>();
  const byCategory = new Map<string, number[]>();
  const push = (map: Map<string, number[]>, key: string | undefined, index: number) => {
    if (!key) return;
    const list = map.get(key);
    if (list) list.push(index);
    else map.set(key, [index]);
  };
  rules.forEach((rule, index) => {
    for (const technique of rule.mitreTechniques) push(byTechnique, technique, index);
    push(byProduct, rule.logsource.product, index);
    push(byCategory, rule.logsource.category, index);
  });
  return { byTechnique, byProduct, byCategory, rules };
}

export function similarRules(rule: SigmaRule, index: SimilarityIndex, limit = 4): SimilarRule[] {
  const scores = new Map<number, number>();
  const bump = (candidates: number[] | undefined, weight: number) => {
    if (!candidates) return;
    for (const candidate of candidates) {
      scores.set(candidate, (scores.get(candidate) ?? 0) + weight);
    }
  };

  for (const technique of rule.mitreTechniques) bump(index.byTechnique.get(technique), 3);
  bump(index.byProduct.get(rule.logsource.product ?? ''), 1);
  bump(index.byCategory.get(rule.logsource.category ?? ''), 2);

  const ownTags = new Set(rule.tags);

  const ranked = [...scores.entries()]
    .filter(([i]) => index.rules[i]!.slug !== rule.slug)
    .map(([i, score]) => {
      const candidate = index.rules[i]!;
      const sharedTags = candidate.tags.filter((tag) => ownTags.has(tag)).length;
      return { i, score: score + sharedTags, candidate };
    })
    .filter(({ score }) => score >= 4)
    .sort((a, b) => b.score - a.score || a.candidate.title.localeCompare(b.candidate.title))
    .slice(0, limit);

  return ranked.map(({ candidate }) => {
    const sharedTechniques = candidate.mitreTechniques.filter((t) =>
      rule.mitreTechniques.includes(t),
    );
    const reason = sharedTechniques.length
      ? `Shares ${sharedTechniques.slice(0, 3).join(', ')}`
      : candidate.logsource.category && candidate.logsource.category === rule.logsource.category
        ? `Same logsource category (${candidate.logsource.category})`
        : 'Shared tags and logsource';
    return {
      slug: candidate.slug,
      title: candidate.title,
      level: candidate.level,
      product: candidate.logsource.product,
      reason,
    };
  });
}
