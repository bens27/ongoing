import { json } from '@sveltejs/kit';
import { logoListingResponse } from '$lib/server/attachments';
import type { RequestHandler } from './$types';

/** Every project's current identity logo: references plus artifact URLs, keyed for consumer sites. */
export const GET: RequestHandler = async ({ url }) => {
  try {
    const { attachmentService } = await import('$lib/server/scanning/runtime');
    return json(
      await logoListingResponse(attachmentService, url.searchParams.get('field') ?? undefined),
      {
        headers: { 'cache-control': 'no-store' }
      }
    );
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'Logo listing unavailable' },
      { status: 503 }
    );
  }
};
