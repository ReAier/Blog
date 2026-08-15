import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import type { AstroIntegration } from 'astro';

async function copyDirectory(source: string, target: string): Promise<void> {
  let entries;
  try { entries = await readdir(source, { withFileTypes: true }); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  await mkdir(target, { recursive: true });
  for (const entry of entries) {
    if (entry.name === '.gitkeep') continue;
    const sourcePath = join(source, entry.name);
    const targetPath = join(target, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Managed content images cannot contain symbolic links: ${sourcePath}`);
    if (entry.isDirectory()) await copyDirectory(sourcePath, targetPath);
    else if (entry.isFile()) await cp(sourcePath, targetPath, { force: true });
  }
}

export async function copyManagedImages(imagesRoot: string, outputRoot: string): Promise<void> {
  const mediaRoot = resolve(outputRoot, 'media');
  await rm(mediaRoot, { recursive: true, force: true });
  await copyDirectory(resolve(imagesRoot), mediaRoot);
}

export function managedContentIntegration(imagesRoot: string): AstroIntegration {
  return {
    name: 'aier-managed-content',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        await copyManagedImages(imagesRoot, fileURLToPath(dir));
      },
    },
  };
}
