import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import type { SigmaRule } from '../lib/sigma';
import { recentRules } from '../lib/feed';
import { joinBase, rulePath } from '../lib/urls';

export async function GET(context: APIContext) {
  const { default: rules } = (await import('../generated/rules.json')) as {
    default: SigmaRule[];
  };
  const base = import.meta.env.BASE_URL;

  return rss({
    title: 'Sigma Rule Library — recent critical rules',
    description:
      'The most recently added or modified critical-severity Sigma detection rules from the SigmaHQ repository.',
    site: context.site ?? 'https://cerez23.github.io',
    items: recentRules(rules, { limit: 50, onlyLevel: 'critical' }).map((item) => ({
      title: item.title,
      link: joinBase(base, rulePath(item.slug)),
      pubDate: new Date(`${item.date}T00:00:00Z`),
      description: item.description,
    })),
    customData: '<language>en</language>',
  });
}
