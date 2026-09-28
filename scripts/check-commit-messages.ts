import { execFileSync } from 'node:child_process';

const TYPES = 'feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert';
const SUBJECT = new RegExp(`^(${TYPES})(\\([a-z0-9][a-z0-9._/-]*\\))?!?: \\S(?:.*\\S)?$`);

/** Bodies and trailers are deliberately outside the subject policy. */
export function validCommitMessage(message: string, parentCount = 1): boolean {
  const subject = message.split('\n', 1)[0];
  return parentCount > 1 || /^Revert ".+"$/.test(subject) || SUBJECT.test(subject);
}

function git(args: string[], cwd: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

export function checkCommitMessages(range: string, cwd = process.cwd()): string[] {
  // Require both endpoints and resolve them separately: neither options nor pathspecs can
  // turn an invalid range into a successful check of unrelated (or zero) commits.
  const match = /^([^\s]+)\.\.([^\s]+)$/.exec(range);
  if (!match || match[1].includes('..') || match[2].startsWith('.')) {
    throw new Error('Expected an explicit two-dot range: <base>..<head>');
  }
  const resolve = (revision: string) =>
    git(['rev-parse', '--verify', '--end-of-options', `${revision}^{commit}`], cwd).trim();
  const base = resolve(match[1]);
  const head = resolve(match[2]);
  const commits = git(['rev-list', '--reverse', `${base}..${head}`, '--'], cwd).trim();
  if (!commits) return [];
  return commits.split('\n').flatMap((id) => {
    const record = git(['show', '-s', '--format=%P%n%B', id, '--'], cwd);
    const newline = record.indexOf('\n');
    const parents = record.slice(0, newline).trim().split(/\s+/).filter(Boolean);
    const message = record.slice(newline + 1);
    return validCommitMessage(message, parents.length)
      ? []
      : [`${id}: ${JSON.stringify(message.split('\n', 1)[0])}`];
  });
}

if (import.meta.main) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 1) throw new Error('Usage: bun run check:commits <base>..<head>');
    const failures = checkCommitMessages(args[0]);
    if (failures.length) {
      console.error(
        `Invalid commit subjects:\n${failures.join('\n')}\n\nUse type(scope optional): summary, e.g. fix(cli): handle missing entries.\nAllowed types: ${TYPES.replaceAll('|', ', ')}. See CONTRIBUTING.md.`
      );
      process.exitCode = 1;
    } else {
      console.log(`Commit messages conform in ${args[0]}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
