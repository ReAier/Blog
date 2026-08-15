import { createHash } from 'node:crypto';
import {
  cp,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { basename, extname, join, parse, relative, resolve } from 'node:path';
import { createAdminConfig } from '../server/config';
import { scanClipFences, serializeClipReference } from '../server/content/clips';
import { resolveContentPath } from '../server/content/paths';

interface ClipMove {
  slug: string;
  source: string;
  directory: string;
  manifest: string;
}

interface ImageMove {
  oldPath: string;
  newPath: string;
  source: string;
  target: string;
}

export interface IndependentAssetMigrationPlan {
  posts: Array<{ path: string; content: string }>;
  clips: ClipMove[];
  images: ImageMove[];
  redirects: Record<string, string>;
}

function normalizedStem(file: string): string {
  return parse(file).name
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'image';
}

async function listFiles(root: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(path));
    else if (entry.isFile() && entry.name !== '.gitkeep') files.push(path);
  }
  return files;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

async function readRedirects(contentRoot: string): Promise<Record<string, string>> {
  try {
    return JSON.parse(await readFile(resolveContentPath(contentRoot, 'redirects.json'), 'utf8')) as Record<string, string>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw error;
  }
}

export async function planIndependentAssetMigration(contentRoot: string): Promise<IndependentAssetMigrationPlan> {
  const blogRoot = resolveContentPath(contentRoot, 'blog');
  const clipsRoot = resolveContentPath(contentRoot, 'clips');
  const imagesRoot = resolveContentPath(contentRoot, 'images');
  const postPaths = (await listFiles(blogRoot)).filter((path) => extname(path).toLowerCase() === '.md');
  const postContents = new Map<string, string>();
  const originalPostContents = new Map<string, string>();
  for (const path of postPaths) {
    const content = await readFile(path, 'utf8');
    postContents.set(path, content);
    originalPostContents.set(path, content);
  }

  const clips: ClipMove[] = [];
  const seenSlugs = new Set<string>();
  for (const [postPath, original] of postContents) {
    let content = original;
    const fences = scanClipFences(original).filter((fence) => fence.metadata).reverse();
    for (const fence of fences) {
      const metadata = fence.metadata!;
      if (seenSlugs.has(fence.slug)) throw new Error(`Duplicate legacy clip slug: ${fence.slug}`);
      seenSlugs.add(fence.slug);
      const source = resolveContentPath(clipsRoot, metadata.file);
      if (!await pathExists(source)) throw new Error(`Clip source does not exist: ${metadata.file}`);
      const directory = resolveContentPath(clipsRoot, fence.slug);
      if (await pathExists(directory)) throw new Error(`Clip directory already exists: ${fence.slug}`);
      clips.push({
        slug: fence.slug,
        source,
        directory,
        manifest: `${JSON.stringify({ version: 1, ...metadata }, null, 2)}\n`,
      });
      content = `${content.slice(0, fence.start)}${serializeClipReference(fence.slug)}${content.slice(fence.end)}`;
    }
    postContents.set(postPath, content);
  }

  const redirects = await readRedirects(contentRoot);
  const images: ImageMove[] = [];
  const targetByHash = new Map<string, string>();
  for (const source of await listFiles(imagesRoot)) {
    const oldPath = relative(imagesRoot, source).replaceAll('\\', '/');
    if (/^[a-z0-9][a-z0-9-]*-[a-f0-9]{12}\.webp$/.test(oldPath)) continue;
    const bytes = await readFile(source);
    const hash = createHash('sha256').update(bytes).digest('hex');
    const newPath = targetByHash.get(hash)
      ?? `${normalizedStem(basename(source))}-${hash.slice(0, 12)}${extname(source).toLowerCase()}`;
    targetByHash.set(hash, newPath);
    images.push({ oldPath, newPath, source, target: resolveContentPath(imagesRoot, newPath) });
    redirects[`/media/${oldPath}`] = `/media/${newPath}`;
  }

  for (const [postPath, original] of postContents) {
    let content = original;
    for (const image of images) {
      content = content
        .replaceAll(`../images/${image.oldPath}`, `../images/${image.newPath}`)
        .replaceAll(`images/${image.oldPath}`, `images/${image.newPath}`)
        .replaceAll(`/media/${image.oldPath}`, `/media/${image.newPath}`);
    }
    postContents.set(postPath, content);
  }

  return {
    posts: [...postContents]
      .filter(([path, content]) => originalPostContents.get(path) !== content)
      .map(([path, content]) => ({ path, content })),
    clips,
    images,
    redirects,
  };
}

export async function applyIndependentAssetMigration(options: {
  contentRoot: string;
  backupRoot: string;
  dryRun?: boolean;
}): Promise<IndependentAssetMigrationPlan> {
  const plan = await planIndependentAssetMigration(options.contentRoot);
  if (options.dryRun) return plan;

  await mkdir(options.backupRoot, { recursive: true });
  await cp(options.contentRoot, resolve(options.backupRoot, 'content'), {
    recursive: true,
    errorOnExist: true,
  });

  for (const clip of plan.clips) {
    await mkdir(clip.directory, { recursive: false });
    await rename(clip.source, resolve(clip.directory, basename(clip.source)));
    await writeFile(resolve(clip.directory, 'meta.json'), clip.manifest, 'utf8');
  }
  for (const image of plan.images) {
    if (!await pathExists(image.target)) await cp(image.source, image.target, { errorOnExist: true });
  }
  for (const post of plan.posts) await writeFile(post.path, post.content, 'utf8');
  await writeFile(
    resolveContentPath(options.contentRoot, 'redirects.json'),
    `${JSON.stringify(plan.redirects, null, 2)}\n`,
    'utf8',
  );
  for (const image of plan.images) {
    if (resolve(image.source) !== resolve(image.target)) await rm(image.source, { force: true });
  }
  for (const directory of (await readdir(resolveContentPath(options.contentRoot, 'images'), { withFileTypes: true }))) {
    if (!directory.isDirectory()) continue;
    await rm(resolveContentPath(options.contentRoot, 'images', directory.name), { recursive: true, force: true });
  }
  return plan;
}

const isEntrypoint = process.argv[1]
  && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (value) => value.slice(1)));

if (isEntrypoint) {
  const config = createAdminConfig();
  const dryRun = process.argv.some((value) => value.toLowerCase() === '-dryrun' || value === '--dry-run');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const plan = await applyIndependentAssetMigration({
    contentRoot: config.contentRoot,
    backupRoot: resolve(config.dataRoot, 'migrations', timestamp),
    dryRun,
  });
  process.stdout.write(`${JSON.stringify({
    dryRun,
    clips: plan.clips.map((clip) => clip.slug),
    images: plan.images.map((image) => ({ from: image.oldPath, to: image.newPath })),
    changedPosts: plan.posts.length,
  }, null, 2)}\n`);
}
