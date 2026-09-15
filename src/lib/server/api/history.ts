import { json } from '@sveltejs/kit';
import { HistoryReadError } from '$lib/domain/entry-history';
import { readEntryHistory } from '$lib/server/catalog/history';
import type { CatalogRepository } from '$lib/server/catalog/repository';

export function entryHistoryResponse(
  repository: CatalogRepository,
  kind: string,
  slug: string,
  parameter: (name: string) => string | null
): Response {
  try {
    return json(
      readEntryHistory(repository, kind, slug, {
        metric: parameter('metric'),
        days: parameter('days') ?? undefined
      })
    );
  } catch (error) {
    if (error instanceof HistoryReadError)
      return json({ error: error.message }, { status: error.status });
    throw error;
  }
}
