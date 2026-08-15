import { createHash } from 'node:crypto';
import { COPYFILE_FICLONE } from 'node:constants';
import { createReadStream } from 'node:fs';
import { copyFile, cp, link, mkdir, readlink, readdir, rm, stat, symlink } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';

async function files(root: string, current = root): Promise<string[]> {
  let entries;
  try { entries = await readdir(current, { withFileTypes: true }); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const result: string[] = [];
  for (const entry of entries) {
    const path = join(current, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Content snapshots cannot include symbolic links: ${path}`);
    if (entry.isDirectory()) result.push(...await files(root, path));
    else if (entry.isFile() && entry.name !== '.gitkeep') result.push(relative(root, path).split(sep).join('/'));
  }
  return result.sort((left, right) => left.localeCompare(right));
}

export async function hashContentTree(contentRoot: string): Promise<string> {
  const root = resolve(contentRoot);
  const hash = createHash('sha256');
  for (const path of await files(root)) {
    hash.update(path).update('\0');
    for await (const chunk of createReadStream(resolve(root, path))) hash.update(chunk as Buffer);
    hash.update('\0');
  }
  return hash.digest('hex');
}

const ignoredNames = new Set(['.git', '.astro', '.deploy', '.worktrees', 'dist', 'node_modules']);
const dependencyCacheNames = new Set(['.astro', '.cache', '.vite', '.vite-temp']);
const linkFallbackCodes = new Set(['EACCES', 'EPERM', 'EXDEV', 'ENOTSUP']);

async function cloneDependencyTree(source: string, destination: string, root = source): Promise<void> {
  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (source === root && dependencyCacheNames.has(entry.name)) continue;
    const sourcePath = join(source, entry.name);
    const destinationPath = join(destination, entry.name);
    if (entry.isDirectory()) {
      await cloneDependencyTree(sourcePath, destinationPath, root);
      continue;
    }
    if (entry.isSymbolicLink()) {
      const target = await readlink(sourcePath);
      const targetType = (await stat(sourcePath)).isDirectory() ? 'dir' : 'file';
      await symlink(
        process.platform === 'win32' && targetType === 'dir'
          ? resolve(dirname(sourcePath), target)
          : target,
        destinationPath,
        process.platform === 'win32' && targetType === 'dir' ? 'junction' : targetType,
      );
      continue;
    }
    if (!entry.isFile()) continue;
    try {
      await link(sourcePath, destinationPath);
    } catch (error) {
      if (!linkFallbackCodes.has((error as NodeJS.ErrnoException).code ?? '')) throw error;
      await copyFile(sourcePath, destinationPath, COPYFILE_FICLONE);
    }
  }
}

export async function createBuildSnapshot(options: { projectRoot: string; contentRoot: string; jobsRoot: string; id: string }) {
  const workspace = resolve(options.jobsRoot, options.id, 'workspace');
  await rm(workspace, { recursive: true, force: true });
  await mkdir(workspace, { recursive: true });
  await cp(resolve(options.projectRoot), workspace, {
    recursive: true,
    filter: (source) => {
      const relativePath = relative(resolve(options.projectRoot), source);
      if (!relativePath) return true;
      const parts = relativePath.split(sep);
      if (ignoredNames.has(parts[0]!)) return false;
      if (parts[0] === 'src' && parts[1] === 'content') return false;
      return true;
    },
  });
  await mkdir(resolve(workspace, 'src'), { recursive: true });
  await cp(resolve(options.contentRoot), resolve(workspace, 'src/content'), { recursive: true });
  const nodeModules = resolve(options.projectRoot, 'node_modules');
  try {
    if ((await stat(nodeModules)).isDirectory()) {
      await cloneDependencyTree(nodeModules, resolve(workspace, 'node_modules'));
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  return { workspace, contentHash: await hashContentTree(options.contentRoot) };
}
