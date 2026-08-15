import { createHash } from 'node:crypto';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import sharp from 'sharp';

export interface ImageServiceOptions {
  contentRoot: string;
  maxBytes?: number;
  maxPixels?: number;
  maxEdge?: number;
  quality?: number;
}

function slugFileName(value: string): string {
  const stem = basename(value)
    .replace(/\.[^.]+$/, '')
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return stem || 'image';
}

export class ImageService {
  readonly options: Required<ImageServiceOptions>;

  constructor(options: ImageServiceOptions) {
    this.options = {
      maxBytes: 12 * 1024 * 1024,
      maxPixels: 30_000_000,
      maxEdge: 2560,
      quality: 82,
      ...options,
    };
  }

  async upload(input: { originalName: string; bytes: Buffer; ownerPostSlug?: string }) {
    if (input.bytes.byteLength === 0 || input.bytes.byteLength > this.options.maxBytes) {
      throw new Error('Image exceeds the upload limit.');
    }
    const image = sharp(input.bytes, {
      limitInputPixels: this.options.maxPixels,
      failOn: 'warning',
    }).rotate();
    const source = await image.metadata();
    if (!['jpeg', 'png', 'webp'].includes(source.format ?? '')) {
      throw new Error('Only JPEG, PNG and WebP images are accepted.');
    }
    const bytes = await image
      .resize({
        width: this.options.maxEdge,
        height: this.options.maxEdge,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: this.options.quality })
      .toBuffer();
    const metadata = await sharp(bytes).metadata();
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const imagesRoot = resolve(this.options.contentRoot, 'images');
    await mkdir(imagesRoot, { recursive: true });
    const hashSuffix = `-${sha256.slice(0, 12)}.webp`;
    const existing = (await readdir(imagesRoot, { withFileTypes: true }))
      .find((entry) => entry.isFile() && entry.name.endsWith(hashSuffix));
    const file = existing?.name ?? `${slugFileName(input.originalName)}${hashSuffix}`;
    const relativePath = `images/${file}`;
    const outputPath = resolve(this.options.contentRoot, relativePath);
    await writeFile(outputPath, bytes, { flag: 'wx', mode: 0o600 }).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'EEXIST') throw error;
    });
    return {
      id: sha256,
      relativePath,
      width: metadata.width!,
      height: metadata.height!,
      byteSize: bytes.byteLength,
      sha256,
      references: [],
    };
  }
}
