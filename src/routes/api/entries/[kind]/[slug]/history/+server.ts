import { entryHistoryResponse } from '$lib/server/api/history';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
  const { catalogRepository } = await import('$lib/server/scanning/runtime');
  return entryHistoryResponse(catalogRepository, params.kind, params.slug, (name) =>
    url.searchParams.get(name)
  );
};
