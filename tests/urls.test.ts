import { describe, expect, it } from 'vitest';
import { canonicalUrl, joinBase, libraryPath, rulePath } from '@lib/urls';
import { isSafeExternalUrl, safeReferences } from '@lib/security';

describe('GitHub Pages base path handling (SPEC §14)', () => {
  it('joins a project-page base path', () => {
    expect(joinBase('/sigma-rule-library', '/library/')).toBe('/sigma-rule-library/library/');
    expect(joinBase('/sigma-rule-library/', '/library/')).toBe('/sigma-rule-library/library/');
  });

  it('works at the domain root', () => {
    expect(joinBase('/', '/library/')).toBe('/library/');
    expect(joinBase('', '/library/')).toBe('/library/');
  });

  it('normalizes paths without a leading slash', () => {
    expect(joinBase('/repo', 'about/')).toBe('/repo/about/');
  });

  it('builds absolute canonical URLs', () => {
    expect(canonicalUrl('https://user.github.io', '/repo', '/rules/x/')).toBe(
      'https://user.github.io/repo/rules/x/',
    );
    expect(canonicalUrl('https://user.github.io/', '/', '/')).toBe('https://user.github.io/');
  });

  it('builds rule and library paths', () => {
    expect(rulePath('abc')).toBe('/rules/abc/');
    expect(libraryPath({ q: 'powershell', product: 'windows' })).toBe(
      '/library/?q=powershell&product=windows',
    );
    expect(libraryPath()).toBe('/library/');
  });
});

describe('external URL safety (SPEC §16)', () => {
  it('allows only http(s)', () => {
    expect(isSafeExternalUrl('https://example.com/x')).toBe(true);
    expect(isSafeExternalUrl('http://example.com')).toBe(true);
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeExternalUrl('data:text/html,<script>')).toBe(false);
    expect(isSafeExternalUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeExternalUrl('not a url')).toBe(false);
  });

  it('safeReferences marks unsafe entries instead of dropping them silently', () => {
    const refs = safeReferences(['https://ok.example', 'javascript:alert(1)', '  ']);
    expect(refs).toEqual([
      { url: 'https://ok.example', safe: true },
      { url: 'javascript:alert(1)', safe: false },
    ]);
  });
});
