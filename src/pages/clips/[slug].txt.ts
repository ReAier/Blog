import type { APIRoute } from 'astro';
import { getAllClips, type ClipRecord } from '../../lib/clips';

export function getStaticPaths() {
  return getAllClips().map((clip) => ({ params: { slug: clip.slug }, props: { clip } }));
}

export const GET: APIRoute = ({ props }) => {
  const clip = props.clip as ClipRecord;
  const fallbackName = clip.file.replace(/[^a-zA-Z0-9._-]/g, '_');
  const encodedName = encodeURIComponent(clip.file);

  return new Response(clip.code, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`,
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
};
