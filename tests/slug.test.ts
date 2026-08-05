import { describe, expect, it } from 'vitest';
import { isUuid, shortHash, slugForRule, slugifyTitle } from '@lib/slug';

describe('slug generation (SPEC §5)', () => {
  it('prefers the Sigma UUID', () => {
    expect(slugForRule('3B6AB547-8EC2-4991-B9D2-2B06702A48D7', 'Any Title', 'rules/a.yml')).toBe(
      '3b6ab547-8ec2-4991-b9d2-2b06702a48d7',
    );
  });

  it('falls back to title slug + path hash when the id is missing or not a UUID', () => {
    const slug = slugForRule('not-a-uuid', 'Suspicious PowerShell Download!', 'rules/win/x.yml');
    expect(slug).toMatch(/^suspicious-powershell-download-[0-9a-f]{8}$/);
    expect(slugForRule(undefined, 'Rule', 'rules/a.yml')).toMatch(/^rule-[0-9a-f]{8}$/);
  });

  it('never uses the bare title: same title, different paths -> different slugs', () => {
    const a = slugForRule(undefined, 'Same Title', 'rules/a.yml');
    const b = slugForRule(undefined, 'Same Title', 'rules/b.yml');
    expect(a).not.toBe(b);
  });

  it('slugifies messy titles safely', () => {
    expect(slugifyTitle('  Ünïcode — Ätt&ck / Rule  ')).toBe('unicode-att-ck-rule');
    expect(slugifyTitle('***')).toBe('untitled');
    expect(slugifyTitle('x'.repeat(200)).length).toBeLessThanOrEqual(80);
  });

  it('shortHash is deterministic and hex', () => {
    expect(shortHash('rules/a.yml')).toBe(shortHash('rules/a.yml'));
    expect(shortHash('rules/a.yml')).not.toBe(shortHash('rules/b.yml'));
    expect(shortHash('anything')).toMatch(/^[0-9a-f]{8}$/);
  });

  it('validates UUIDs strictly', () => {
    expect(isUuid('3b6ab547-8ec2-4991-b9d2-2b06702a48d7')).toBe(true);
    expect(isUuid('3b6ab547')).toBe(false);
  });
});
