import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkCommitMessages, validCommitMessage } from '../scripts/check-commit-messages';

describe('commit message policy', () => {
  it.each([
    'feat: add exports',
    'fix(cli): handle missing entries',
    'feat!: change the query format',
    'refactor(api)!: remove the legacy route',
    'ci(github-actions): check commits',
    'Revert "Old unformatted subject"'
  ])('accepts %s', (message) => expect(validCommitMessage(message)).toBe(true));

  it.each([
    'Add exports',
    'unknown: add exports',
    'Fix: repair it',
    'fix(): repair it',
    'fix(bad scope): repair it',
    'fix:missing space',
    'fix: ',
    'fix:   ',
    '',
    'fix:  extra space',
    'fix: trailing space ',
    'fix!!: repair it',
    'Revert anything',
    'Merge an ordinary change'
  ])('rejects %s', (message) => expect(validCommitMessage(message)).toBe(false));

  it('exempts actual merges regardless of their subject', () => {
    expect(validCommitMessage('Custom merge subject', 2)).toBe(true);
    expect(validCommitMessage('Custom merge subject', 1)).toBe(false);
  });

  it('ignores multiline bodies and preserves Nightshift trailers', () => {
    const message =
      'chore: standardize commit messages\n\nAn unrestricted body.\nMore detail.\n\nNightshift-Task: commit-normalize\nNightshift-Ref: https://example.com/nightshift\n';
    const before = message;
    expect(validCommitMessage(message)).toBe(true);
    expect(message).toBe(before);
    expect(validCommitMessage('invalid subject\n\nfix: valid body')).toBe(false);
  });

  it('checks only the requested Git range through the CLI without changing messages', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'commit-policy-'));
    const git = (...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
    const commit = (message: string) => {
      git(
        '-c',
        'user.name=Test',
        '-c',
        'user.email=test@example.com',
        'commit',
        '--allow-empty',
        '--no-gpg-sign',
        '-m',
        message
      );
      return git('rev-parse', 'HEAD');
    };
    const cli = (...args: string[]) =>
      spawnSync('bun', [resolve('scripts/check-commit-messages.ts'), ...args], {
        cwd,
        encoding: 'utf8'
      });
    try {
      git('init', '-q');
      const base = commit('Legacy unformatted subject');
      const message =
        'fix: keep trailers\n\nBody text\n\nNightshift-Task: commit-normalize\nNightshift-Ref: https://example.com/nightshift';
      const valid = commit(message);
      const bad = commit('Invalid new subject');
      expect(checkCommitMessages(`${base}..${valid}`, cwd)).toEqual([]);
      expect(cli(`${base}..${valid}`).status).toBe(0);
      expect(checkCommitMessages(`${valid}..${bad}`, cwd)).toEqual([
        `${bad}: "Invalid new subject"`
      ]);
      const rejected = cli(`${base}..${bad}`);
      expect(rejected.status).toBe(1);
      expect(rejected.stderr).toContain(bad);
      expect(rejected.stderr).toContain('fix(cli): handle missing entries');
      expect(rejected.stderr).not.toContain(base);
      expect(git('show', '-s', '--format=%B', valid)).toBe(message);
      expect(cli(`${valid}..${valid}`).status).toBe(0);
      for (const range of [
        'missing..HEAD',
        'HEAD',
        'HEAD...HEAD',
        '..HEAD',
        'HEAD..',
        '--all..HEAD'
      ]) {
        expect(cli(range).status, range).toBe(1);
      }
      expect(cli().status).toBe(1);
      expect(cli(`${base}..${valid}`, 'extra').status).toBe(1);
      git('checkout', '-q', '-b', 'side', valid);
      commit('docs: describe the change');
      git('checkout', '-q', '-b', 'merge-target', bad);
      git(
        '-c',
        'user.name=Test',
        '-c',
        'user.email=test@example.com',
        'merge',
        '--no-ff',
        '--no-gpg-sign',
        'side',
        '-m',
        'Custom merge subject'
      );
      expect(checkCommitMessages(`${bad}..HEAD`, cwd)).toEqual([]);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
