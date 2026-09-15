import type { EntryView } from '$lib/domain/entry-view';
import type { Catalog } from '../catalog.svelte';
import type { ProjectOverview } from '../overview';
import type { MenuItem } from './ActionsMenu.svelte';

/**
 * The project overview's infrequent actions and the "copy path" fallback, shared by the panel and
 * the fact sheet so the two surfaces cannot drift on what a project can do — the plan's
 * requirement that both show identical actions for one project.
 */

export async function copyProjectPath(
  entry: EntryView,
  catalog: Catalog,
  oninspect: (query?: string) => void
): Promise<void> {
  if (!entry.path) return;
  try {
    await navigator.clipboard.writeText(entry.path);
    catalog.message = { text: 'Project path copied', tone: 'info' };
  } catch {
    // Clipboard access is denied in some contexts; the inspector shows the path as text.
    oninspect('path');
  }
}

export function projectMenuItems({
  entry,
  overview,
  catalog,
  onrename,
  oncopypath,
  oninspect,
  onopenpalette
}: {
  entry: EntryView;
  overview: ProjectOverview;
  catalog: Catalog;
  onrename: () => void;
  oncopypath: () => void;
  oninspect: (query?: string) => void;
  onopenpalette?: () => void;
}): MenuItem[] {
  const items: MenuItem[] = [
    {
      id: 'favorite',
      label: entry.isFavorite ? 'Remove from favorites' : 'Add to favorites',
      icon: 'star',
      hint: `ongoing favorite ${entry.slug}`,
      run: () => void catalog.setField(entry, 'is_favorite', !entry.isFavorite)
    },
    {
      id: 'hide',
      label: entry.isHidden ? 'Unhide' : 'Hide',
      icon: 'eye-off',
      hint: `ongoing ${entry.isHidden ? 'unhide' : 'hide'} ${entry.slug}`,
      run: () => void catalog.setField(entry, 'is_hidden', !entry.isHidden)
    },
    {
      id: 'rename',
      label: 'Rename',
      icon: 'pencil',
      hint: `ongoing set ${entry.slug} name <name>`,
      run: onrename
    }
  ];
  if (entry.path)
    items.push(
      {
        id: 'terminal',
        label: 'Open in Terminal',
        icon: 'terminal',
        hint: `ongoing open ${entry.slug} --terminal`,
        run: () => void catalog.open(entry, 'terminal')
      },
      {
        id: 'copy-path',
        label: 'Copy path',
        icon: 'copy',
        run: oncopypath
      }
    );
  if (overview.identity.repositoryUrl)
    items.push({
      id: 'github',
      label: 'Open on GitHub',
      icon: 'github',
      hint: `ongoing open ${entry.slug} --github`,
      run: () => window.open(overview.identity.repositoryUrl!, '_blank', 'noreferrer')
    });
  if (overview.identity.websiteUrl)
    items.push({
      id: 'website',
      label: 'Open website',
      icon: 'globe',
      run: () => window.open(overview.identity.websiteUrl!, '_blank', 'noreferrer')
    });
  items.push({
    id: 'inspect',
    label: 'All fields & sources',
    icon: 'list',
    hint: `ongoing get ${entry.slug}`,
    run: () => oninspect()
  });
  if (onopenpalette)
    items.push({
      id: 'palette',
      label: 'Command palette',
      icon: 'search',
      hint: '⌘K',
      run: onopenpalette
    });
  return items;
}
