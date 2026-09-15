import type { EntryView } from '$lib/domain/entry-view';

/** The GitHub page for an entry, when a hosting provider found one. Pure; no store behind it. */
export function githubUrl(entry: EntryView): string | null {
  const owner = entry.fields['github.owner'];
  const name = entry.fields['github.name'];
  return typeof owner === 'string' && typeof name === 'string'
    ? `https://github.com/${owner}/${name}`
    : null;
}
