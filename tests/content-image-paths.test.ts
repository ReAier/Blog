import { describe, expect, it } from 'vitest';
import { resolveCoverUrl, contentImagePublicPath } from '../src/lib/image-paths';


describe('managed content image URLs', () => {
  it('maps local content images to stable public media URLs', () => {
    expect(contentImagePublicPath('sample-post/diagram.webp')).toBe('/media/sample-post/diagram.webp');
    expect(resolveCoverUrl('../images/hello/cover.webp')).toBe('/media/hello/cover.webp');
    expect(resolveCoverUrl('images/hello/cover.webp')).toBe('/media/hello/cover.webp');
  });

  it('preserves public paths and absolute remote cover URLs', () => {
    expect(resolveCoverUrl('/images/cover.webp')).toBe('/images/cover.webp');
    expect(resolveCoverUrl('https://cdn.example.com/cover.webp')).toBe('https://cdn.example.com/cover.webp');
    expect(resolveCoverUrl(undefined)).toBeUndefined();
  });

  it('rejects traversal in managed image paths', () => {
    expect(() => contentImagePublicPath('../secret.webp')).toThrow();
    expect(() => resolveCoverUrl('../images/../secret.webp')).toThrow();
  });
});
