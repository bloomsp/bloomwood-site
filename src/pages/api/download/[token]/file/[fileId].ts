import type { APIRoute } from 'astro';
import {
  getDownloadFile,
  incrementDownloadCount,
  logDownloadEvent,
  sha256Hex,
  type DownloadEnv,
} from '@/lib/server/downloads';

export const prerender = false;

export const GET: APIRoute = async ({ params, locals, request }) => {
  const env = (locals.runtime?.env ?? {}) as DownloadEnv;
  const token = params.token ?? '';
  const fileId = params.fileId ?? '';

  const clientIp = request.headers.get('CF-Connecting-IP') ?? null;
  const ipHash = clientIp ? await sha256Hex(clientIp) : null;
  const userAgent = request.headers.get('user-agent') ?? null;
  const country = request.headers.get('CF-IPCountry') ?? null;

  try {
    const result = await getDownloadFile(env, token, fileId);

    if (!result) {
      await logDownloadEvent(env, {
        tokenId: null,
        jobId: null,
        fileId,
        eventType: 'blocked',
        ipHash,
        userAgent,
        country,
        detail: 'Invalid token or file lookup',
      }).catch(() => {});

      return new Response('This download link is invalid or has expired.', { status: 404 });
    }

    const { access, file, object } = result;

    const headers = new Headers();
    object.writeHttpMetadata?.(headers);
    headers.set('Content-Type', file.contentType || headers.get('Content-Type') || 'application/octet-stream');
    headers.set('Content-Disposition', `attachment; filename="${file.displayName.replace(/"/g, '')}"`);
    headers.set('Cache-Control', 'private, no-store');
    if (object.httpEtag) headers.set('ETag', object.httpEtag);

    await incrementDownloadCount(env, access.token.tokenId);
    await logDownloadEvent(env, {
      tokenId: access.token.tokenId,
      jobId: access.job.id,
      fileId: file.id,
      eventType: 'download',
      ipHash,
      userAgent,
      country,
    });

    return new Response(object.body, { status: 200, headers });
  } catch (error) {
    console.error('Download failed', error);
    return new Response('Download unavailable right now.', { status: 500 });
  }
};
