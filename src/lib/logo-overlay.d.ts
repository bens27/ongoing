// Types for the private @impressions/logo overlay. The package is intentionally NOT a
// dependency: it is the author's own artwork tooling, vended locally under vendor/ (gitignored).
// Public clones build and type-check without it; every import site degrades gracefully when
// the overlay is absent. To enable logo support locally, drop the tarball in vendor/ and run
// `bun add file:./vendor/impressions-logo-<version>.tgz`, then revert package.json/bun.lock
// (`git checkout -- package.json bun.lock`) to keep the manifests public-clean.
declare module '@impressions/logo/document' {
  export function parseLogoDocument(value: unknown): {
    camera: unknown;
    [key: string]: unknown;
  };
}

declare module '@impressions/logo/viewer' {
  export function mountLogoViewer(
    host: HTMLElement,
    parsed: unknown,
    options: {
      interactive: boolean;
      rotating: boolean;
      onready: () => void;
      onerror: () => void;
    }
  ): { dispose(): void; setCamera(camera: unknown): void };
}
