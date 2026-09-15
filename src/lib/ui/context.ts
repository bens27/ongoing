import { getContext, setContext } from 'svelte';
import type { Catalog } from './catalog.svelte';

const CATALOG = Symbol('ongoing.catalog');

/** One catalog per shell, shared by the inventory, the fact sheets, the radar, and the palette. */
export function setCatalogContext(catalog: Catalog): Catalog {
  return setContext(CATALOG, catalog);
}

export function getCatalogContext(): Catalog {
  return getContext<Catalog>(CATALOG);
}

const SHELL = Symbol('ongoing.shell');

/**
 * What the shell offers the screens beneath it: today, opening the palette. The palette is the
 * layout's, so a screen that wants to open it — the project panel's actions menu — asks rather
 * than owning a second one.
 */
export interface ShellContext {
  openPalette: () => void;
}

export function setShellContext(shell: ShellContext): ShellContext {
  return setContext(SHELL, shell);
}

export function getShellContext(): ShellContext | undefined {
  return getContext<ShellContext | undefined>(SHELL);
}
