import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import type { Dirent } from 'node:fs';
import { cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, resolve } from 'node:path';
import sharp from 'sharp';
import { createContentRepository } from '../content/repository';
import { scanPostImageReferences } from '../content/images';
import { compileRedirects } from '../redirects/service';
import {
  assertByteLengthWithinLimit,
  MAX_CLIP_BYTES,
  MAX_IMAGE_BYTES,
  MAX_MARKDOWN_BYTES,
} from '../limits';
import type { PublishContext, PublishSnapshot } from './coordinator';

export class BuildGate {
  private tail = Promise.resolve();

  run<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(operation, operation);
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }
}

export function resolveNpmInvocation(
  args: string[],
  runtime: {
    platform?: NodeJS.Platform;
    execPath?: string;
    npmExecPath?: string;
  } = {},
): { command: string; args: string[] } {
  const platform = runtime.platform ?? process.platform;
  if (platform !== 'win32') return { command: 'npm', args };
  const execPath = runtime.execPath ?? process.execPath;
  const npmExecPath = runtime.npmExecPath
    ?? process.env.npm_execpath
    ?? resolve(dirname(execPath), 'node_modules/npm/bin/npm-cli.js');
  return { command: execPath, args: [npmExecPath, ...args] };
}

export async function runCommand(options: {
  command: string;
  args: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  log?: (message: string) => void;
}): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(options.command, options.args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let output = '';
    const consume = (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      output += text;
      options.log?.(text);
    };
    child.stdout.on('data', consume);
    child.stderr.on('data', consume);
    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (code === 0) {
        resolvePromise(output);
        return;
      }
      reject(new Error(
        `${options.command} ${options.args.join(' ')} failed with ${signal ? `signal ${signal}` : `exit code ${code}`}.`,
      ));
    });
  });
}

export async function runNpmCommand(options: {
  args: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  log?: (message: string) => void;
}): Promise<string> {
  const invocation = resolveNpmInvocation(options.args);
  return runCommand({ ...options, ...invocation });
}

function localImagePath(value: string): string | undefined {
  const normalized = value.split(/[?#]/, 1)[0]!.replaceAll('\\', '/');
  if (normalized.startsWith('../images/')) return normalized.slice('../images/'.length);
  if (normalized.startsWith('images/')) return normalized.slice('images/'.length);
  if (normalized.startsWith('/media/')) return normalized.slice('/media/'.length);
  return undefined;
}

export async function validateContentRoot(options: {
  contentRoot: string;
  outputPath: string;
}): Promise<void> {
  const contentRoot = resolve(options.contentRoot);
  const repository = createContentRepository({ root: contentRoot });
  const posts = await repository.listPosts();
  const clips = await repository.listClips();
  const images = await repository.listImages();
  for (const post of posts) {
    const info = await stat(resolve(contentRoot, 'blog', post.fileName));
    assertByteLengthWithinLimit(
      info.size,
      'BLOG_MAX_MARKDOWN_BYTES',
      MAX_MARKDOWN_BYTES,
      `Post ${post.slug}`,
    );
  }
  const clipsRoot = resolve(contentRoot, 'clips');
  let clipEntries: Dirent[];
  try {
    clipEntries = await readdir(clipsRoot, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') clipEntries = [];
    else throw error;
  }
  for (const entry of clipEntries) {
    if (entry.name.startsWith('.')) continue;
    if (!entry.isDirectory()) throw new Error(`Clip entries must be directories: ${entry.name}`);
    const clip = clips.find((item) => item.slug === entry.name);
    if (!clip) throw new Error(`Clip directory is not indexed: ${entry.name}`);
    const info = await stat(resolve(clipsRoot, entry.name, clip.file));
    assertByteLengthWithinLimit(
      info.size,
      'BLOG_MAX_CLIP_BYTES',
      MAX_CLIP_BYTES,
      `Clip source ${entry.name}/${clip.file}`,
    );
  }
  for (const image of images) {
    const pathParts = image.path.split('/');
    if (pathParts.length !== 1 || !/^[a-z0-9][a-z0-9-]*-[a-f0-9]{12}\.webp$/.test(image.path) || extname(image.path) !== '.webp') {
      throw new Error(`Managed images must use images/<name>-<hash>.webp: ${image.path}`);
    }
    assertByteLengthWithinLimit(
      image.byteSize,
      'BLOG_MAX_IMAGE_BYTES',
      MAX_IMAGE_BYTES,
      `Image ${image.path}`,
    );
    const metadata = await sharp(resolve(contentRoot, 'images', image.path), {
      limitInputPixels: 30_000_000,
      failOn: 'warning',
    }).metadata();
    if (metadata.format !== 'webp') throw new Error(`Managed image is not WebP: ${image.path}`);
    if (!metadata.width || !metadata.height || metadata.width > 2560 || metadata.height > 2560) {
      throw new Error(`Managed image dimensions exceed 2560px: ${image.path}`);
    }
  }
  const imagePaths = new Set(images.map((image) => image.path));
  for (const post of posts) {
    for (const reference of scanPostImageReferences(post)) {
      const path = localImagePath(reference.value);
      if (path && !imagePaths.has(path)) {
        throw new Error(`Post ${post.slug} references a missing image: ${reference.value}`);
      }
    }
  }

  const redirectsPath = resolve(contentRoot, 'redirects.json');
  let redirects: Record<string, string> = {};
  try {
    redirects = JSON.parse(await readFile(redirectsPath, 'utf8')) as Record<string, string>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const existingPaths = new Set<string>();
  for (const post of posts) existingPaths.add(`/posts/${post.slug}/`);
  for (const clip of clips) {
    existingPaths.add(`/clips/${clip.slug}/`);
    existingPaths.add(`/clips/${clip.slug}.txt`);
  }
  for (const image of images) existingPaths.add(`/media/${image.path}`);
  const include = compileRedirects({ redirects, existingPaths });
  await writeFile(resolve(options.outputPath), include, 'utf8');
}

export async function validateContentSnapshot(snapshot: PublishSnapshot): Promise<void> {
  await validateContentRoot({
    contentRoot: resolve(snapshot.workspace, 'src/content'),
    outputPath: resolve(snapshot.workspace, '.deploy-redirects.conf'),
  });
}

export const SITE_VERIFICATION_COMMANDS = [
  ['run', 'check'],
  ['run', 'build'],
] as const;

export function siteVerificationEnvironment(): NodeJS.ProcessEnv {
  return { BLOG_BUILD_SNAPSHOT: '1' };
}

export async function runSiteVerification(
  snapshot: PublishSnapshot,
  context: Pick<PublishContext, 'log'>,
): Promise<void> {
  for (const args of SITE_VERIFICATION_COMMANDS) {
    context.log(`$ npm ${args.join(' ')}`);
    await runNpmCommand({
      args: [...args],
      cwd: snapshot.workspace,
      log: context.log,
      env: siteVerificationEnvironment(),
    });
  }
}

async function requestPrivilegedReleaseSwitch(options: {
  requestRoot: string;
  snapshot: PublishSnapshot;
  releaseId: string;
  context: Pick<PublishContext, 'log'>;
}): Promise<{ releaseId: string }> {
  const requestRoot = resolve(options.requestRoot);
  await mkdir(requestRoot, { recursive: true });
  const id = `${options.releaseId}-${randomUUID()}`;
  const requestPath = resolve(requestRoot, `${id}.request.json`);
  const temporaryPath = resolve(requestRoot, `.${id}.tmp`);
  const resultPath = resolve(requestRoot, `${id}.result.json`);
  await writeFile(temporaryPath, `${JSON.stringify({
    id,
    dist: resolve(options.snapshot.workspace, 'dist'),
    redirects: resolve(options.snapshot.workspace, '.deploy-redirects.conf'),
    contentHash: options.snapshot.contentHash,
    releaseId: options.releaseId,
    requestedAt: new Date().toISOString(),
  }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  await rename(temporaryPath, requestPath);
  options.context.log(`Queued privileged release switch ${id}.`);

  const deadline = Date.now() + Number(process.env.BLOG_PUBLISH_SWITCH_TIMEOUT_MS ?? 180_000);
  while (Date.now() < deadline) {
    try {
      const result = JSON.parse(await readFile(resultPath, 'utf8')) as {
        ok: boolean;
        releaseId?: string;
        log?: string;
        error?: string;
      };
      if (result.log) options.context.log(result.log);
      await Promise.all([
        rm(requestPath, { force: true }),
        rm(resultPath, { force: true }),
      ]);
      if (!result.ok) throw new Error(result.error ?? 'Privileged release switch failed.');
      return { releaseId: result.releaseId ?? options.releaseId };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error('Timed out waiting for the privileged release helper.');
}

export async function installRelease(options: {
  snapshot: PublishSnapshot;
  dataRoot: string;
  helper?: string;
  context: Pick<PublishContext, 'log'>;
}): Promise<{ releaseId: string }> {
  const releaseId = `${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}-${options.snapshot.contentHash.slice(0, 12)}`;
  const dist = resolve(options.snapshot.workspace, 'dist');
  const requestRoot = process.env.BLOG_PUBLISH_REQUEST_ROOT;
  if (requestRoot) {
    return requestPrivilegedReleaseSwitch({
      requestRoot,
      snapshot: options.snapshot,
      releaseId,
      context: options.context,
    });
  }
  if (options.helper) {
    const output = await runCommand({
      command: options.helper,
      args: [
        dist,
        options.snapshot.contentHash,
        releaseId,
        resolve(options.snapshot.workspace, '.deploy-redirects.conf'),
      ],
      cwd: options.snapshot.workspace,
      log: options.context.log,
    });
    const announced = /release=([^\s]+)/.exec(output)?.[1];
    return { releaseId: announced ?? releaseId };
  }

  const releasesRoot = resolve(options.dataRoot, 'releases');
  const destination = resolve(releasesRoot, releaseId);
  await mkdir(releasesRoot, { recursive: true });
  await rm(destination, { recursive: true, force: true });
  await cp(dist, destination, { recursive: true });
  await writeFile(resolve(options.dataRoot, 'current-release.json'), `${JSON.stringify({
    releaseId,
    path: destination,
    contentHash: options.snapshot.contentHash,
    installedAt: new Date().toISOString(),
  }, null, 2)}\n`, 'utf8');
  options.context.log(`Development release installed at ${destination}.`);
  return { releaseId };
}

export async function cleanupSnapshot(snapshot: PublishSnapshot): Promise<void> {
  const jobRoot = resolve(snapshot.workspace, '..');
  if (basename(snapshot.workspace) !== 'workspace') return;
  await rm(jobRoot, { recursive: true, force: true });
}
