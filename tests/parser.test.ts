import { describe, expect, it } from 'vitest';
import {
  buildSearchText,
  collectDetectionText,
  normalizeDate,
  parseAuthors,
  parseSigmaFile,
  resolveDuplicates,
  toStringArray,
  type RuleContext,
} from '@lib/sigma';

const ctx: RuleContext = {
  sourcePath: 'rules/windows/process_creation/proc_creation_win_test.yml',
  repositorySection: 'Core Rules',
  sourceCommit: 'abc123def4567890',
  repo: 'SigmaHQ/sigma',
};

const COMPLETE_RULE = `
title: Suspicious PowerShell Download
id: 3b6ab547-8ec2-4991-b9d2-2b06702a48d7
status: test
description: Detects suspicious PowerShell download commands.
references:
    - https://example.com/report
    - javascript:alert(1)
author: Florian Roth (Nextron Systems), Jane Doe
date: 2019/10/23
modified: 2023-01-05
tags:
    - attack.execution
    - attack.t1059.001
    - car.2013-05-009
logsource:
    category: process_creation
    product: windows
detection:
    selection:
        CommandLine|contains:
            - 'DownloadString'
            - 'DownloadFile'
    filter_legit:
        User: 'NT AUTHORITY\\\\SYSTEM'
    condition: selection and not filter_legit
falsepositives:
    - Software installers
level: high
`;

describe('parseSigmaFile — complete rule', () => {
  const { rules, errors } = parseSigmaFile(COMPLETE_RULE, ctx);
  const rule = rules[0]!;

  it('imports without errors', () => {
    expect(errors).toEqual([]);
    expect(rules).toHaveLength(1);
  });

  it('uses the Sigma UUID as slug', () => {
    expect(rule.slug).toBe('3b6ab547-8ec2-4991-b9d2-2b06702a48d7');
  });

  it('splits comma-separated authors', () => {
    expect(rule.author).toEqual(['Florian Roth (Nextron Systems)', 'Jane Doe']);
  });

  it('normalizes both date formats to ISO', () => {
    expect(rule.date).toBe('2019-10-23');
    expect(rule.modified).toBe('2023-01-05');
  });

  it('extracts MITRE tactics, techniques and sub-techniques from tags', () => {
    expect(rule.mitreTactics).toEqual(['execution']);
    expect(rule.mitreTechniques).toEqual(['T1059']);
    expect(rule.mitreSubTechniques).toEqual(['T1059.001']);
  });

  it('keeps non-ATT&CK tags', () => {
    expect(rule.tags).toContain('car.2013-05-009');
  });

  it('preserves the raw YAML verbatim', () => {
    expect(rule.rawYaml).toBe(COMPLETE_RULE);
  });

  it('builds GitHub and raw URLs pinned to the source commit', () => {
    expect(rule.githubUrl).toBe(
      'https://github.com/SigmaHQ/sigma/blob/abc123def4567890/rules/windows/process_creation/proc_creation_win_test.yml',
    );
    expect(rule.rawUrl).toContain('raw.githubusercontent.com/SigmaHQ/sigma/abc123def4567890/');
  });

  it('indexes detection values and technique IDs in searchText', () => {
    expect(rule.searchText).toContain('downloadstring');
    expect(rule.searchText).toContain('t1059.001');
    expect(rule.searchText).toContain('windows');
  });
});

describe('parseSigmaFile — degraded inputs', () => {
  it('imports a rule with missing optional fields', () => {
    const { rules, errors } = parseSigmaFile(
      'title: Minimal Rule\ndetection:\n  selection:\n    a: b\n  condition: selection\n',
      ctx,
    );
    expect(errors).toEqual([]);
    const rule = rules[0]!;
    expect(rule.level).toBeUndefined();
    expect(rule.status).toBeUndefined();
    expect(rule.author).toEqual([]);
    expect(rule.falsePositives).toEqual([]);
    // no UUID -> title slug + path hash, never the bare title
    expect(rule.slug).toMatch(/^minimal-rule-[0-9a-f]{8}$/);
  });

  it('rejects a rule without a title', () => {
    const { rules, errors } = parseSigmaFile('detection:\n  condition: selection\n', ctx);
    expect(rules).toEqual([]);
    expect(errors[0]).toContain('title');
  });

  it('rejects a detection rule without a detection block', () => {
    const { rules, errors } = parseSigmaFile('title: No Detection Here\n', ctx);
    expect(rules).toEqual([]);
    expect(errors[0]).toContain('detection');
  });

  it('reports invalid YAML without throwing', () => {
    const { rules, errors } = parseSigmaFile('title: broken\n  bad_indent: [unclosed\n', ctx);
    expect(rules).toEqual([]);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('handles author as string and as array', () => {
    expect(parseAuthors('Alice, Bob')).toEqual(['Alice', 'Bob']);
    expect(parseAuthors(['Alice', 'Bob'])).toEqual(['Alice', 'Bob']);
    expect(parseAuthors(undefined)).toEqual([]);
  });

  it('handles falsepositives as string and as array', () => {
    const single = parseSigmaFile(
      'title: FP Test\nfalsepositives: Unknown\ndetection:\n  condition: c\n',
      ctx,
    );
    expect(single.rules[0]!.falsePositives).toEqual(['Unknown']);
    const many = parseSigmaFile(
      'title: FP Test\nfalsepositives:\n  - One\n  - Two\ndetection:\n  condition: c\n',
      ctx,
    );
    expect(many.rules[0]!.falsePositives).toEqual(['One', 'Two']);
  });

  it('collects values from deeply nested detection blocks', () => {
    const detection = {
      selection: { EventID: 4688, Image: { endswith: ['\\evil.exe', '\\bad.exe'] } },
      condition: 'selection',
    };
    const text = collectDetectionText(detection).join(' ');
    expect(text).toContain('4688');
    expect(text).toContain('\\evil.exe');
    expect(text).toContain('EventID');
  });
});

describe('helpers', () => {
  it('toStringArray normalizes scalars, arrays and junk', () => {
    expect(toStringArray('x')).toEqual(['x']);
    expect(toStringArray(['a', 2, null, ''])).toEqual(['a', '2']);
    expect(toStringArray({ nested: true })).toEqual([]);
  });

  it('normalizeDate never invents a value', () => {
    expect(normalizeDate(undefined)).toBeUndefined();
    expect(normalizeDate('2021/5/7')).toBe('2021-05-07');
    expect(normalizeDate('circa 2020')).toBe('circa 2020');
  });

  it('buildSearchText deduplicates tokens case-insensitively', () => {
    const { rules } = parseSigmaFile(
      'title: Word word WORD\ndetection:\n  condition: word\n',
      ctx,
    );
    const occurrences = rules[0]!.searchText.split(/\s+/).filter((t) => t === 'word');
    expect(occurrences).toHaveLength(1);
  });
});

describe('resolveDuplicates', () => {
  it('reports duplicate IDs and disambiguates colliding slugs', () => {
    const make = (path: string) =>
      parseSigmaFile(
        `title: Dup\nid: 3b6ab547-8ec2-4991-b9d2-2b06702a48d7\ndetection:\n  condition: c\n`,
        { ...ctx, sourcePath: path },
      ).rules[0]!;
    const rules = [make('rules/a.yml'), make('rules/b.yml')];
    const report = resolveDuplicates(rules);
    expect(report.duplicateIds).toHaveLength(1);
    expect(report.duplicateIds[0]!.files).toEqual(['rules/a.yml', 'rules/b.yml']);
    expect(report.duplicateSlugs).toHaveLength(1);
    expect(rules[0]!.slug).not.toBe(rules[1]!.slug);
  });
});
