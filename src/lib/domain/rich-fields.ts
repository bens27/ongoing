export interface ArtifactRef extends Record<string, unknown> {
  hash: string;
  mediaType: string;
  size: number;
}
export interface RichFieldValue extends Record<string, unknown> {
  kind: string;
  version: number;
  revision: string;
  manifest: ArtifactRef;
  poster: ArtifactRef;
}

export interface RichFieldAdapter {
  id: string;
  bundleKind: string;
  referenceKind: string;
  manifestMediaType: string;
  validateDocument(value: unknown): void | Promise<void>;
}

export class AttachmentConflictError extends Error {
  constructor(
    readonly currentRevision: string | null,
    readonly expectedRevision: string | null
  ) {
    super(
      `Attachment conflict: expected ${expectedRevision ?? 'none'}, current ${currentRevision ?? 'none'}`
    );
    this.name = 'AttachmentConflictError';
  }
}

export const impressionsLogoAdapter: RichFieldAdapter = {
  id: 'impressions.logo.v1',
  bundleKind: 'impressions.logo.bundle',
  referenceKind: 'impressions.logo.ref',
  manifestMediaType: 'application/vnd.impressions.logo+json',
  async validateDocument(value) {
    // The deep logo parser lives in the private @impressions/logo overlay, which public
    // clones do not install. Without it, fall back to a structural check: the revision hash
    // over the canonical document still pins exactly what was stored.
    let parse: ((candidate: unknown) => void) | undefined;
    try {
      const documentModule: string = '@impressions/logo/document';
      ({ parseLogoDocument: parse } = await import(/* @vite-ignore */ documentModule));
    } catch (error) {
      if (!isMissingOverlay(error)) throw error;
    }
    if (parse) {
      parse(value);
      return;
    }
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('logo document must be an object');
  }
};

function isMissingOverlay(error: unknown): boolean {
  // Node/Bun resolution failures, Vite dev SSR misses, and browser bare-specifier
  // failures all land here; anything the parser itself threw must propagate.
  if ((typeof error !== 'object' || error === null) && typeof error !== 'function') return false;

  const { code, message } = error as { code?: unknown; message?: unknown };
  if (typeof message !== 'string') return false;

  const missingModule =
    /Cannot find (?:module|package) ['"]@impressions\/logo\/document['"]/i.test(message) ||
    /Cannot find package ['"]@impressions\/logo['"]/i.test(message);
  const failedResolution =
    /Failed to resolve (?:import|module specifier) ['"]@impressions\/logo\/document['"]/i.test(
      message
    );

  return (code === 'ERR_MODULE_NOT_FOUND' && missingModule) || failedResolution;
}

export const portableJsonAdapter: RichFieldAdapter = {
  id: 'portable.json.v1',
  bundleKind: 'ongoing.portable-json.bundle',
  referenceKind: 'ongoing.portable-json.ref',
  manifestMediaType: 'application/json',
  validateDocument(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('portable JSON document must be an object');
  }
};

const adapters = new Map(
  [impressionsLogoAdapter, portableJsonAdapter].map((adapter) => [adapter.id, adapter])
);
export function richFieldAdapter(id: string): RichFieldAdapter | undefined {
  return adapters.get(id);
}
export function hasRichFieldAdapter(id: string): boolean {
  return adapters.has(id);
}
