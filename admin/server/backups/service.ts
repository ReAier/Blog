import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { cp, mkdir, readFile, readdir, rename, rm, stat } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import yauzl, { type Entry, type ZipFile as ReadZipFile } from 'yauzl';
import { ZipFile } from 'yazl';

export interface BackupManifestFile { path: string; byteSize: number; sha256: string; }
export interface BackupManifest { version: 1; createdAt: string; files: BackupManifestFile[]; }
export interface BackupCandidate { stagingPath: string; manifest: BackupManifest; }

const allowedTopLevel = new Set(['blog', 'clips', 'images', 'redirects.json']);
const openZip = promisify<string, yauzl.Options, ReadZipFile>(yauzl.open);

export function validateArchiveEntryPath(value: string): string {
  if (!value || value.includes('\\') || value.startsWith('/') || /^[A-Za-z]:/.test(value)) {
    throw new Error(`Unsafe archive entry path: ${value}`);
  }
  const parts = value.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) {
    throw new Error(`Unsafe archive entry path: ${value}`);
  }
  if (!allowedTopLevel.has(parts[0]!)) throw new Error(`Unsupported archive entry: ${value}`);
  if (parts[0] === 'redirects.json' && parts.length !== 1) throw new Error(`Unsafe archive entry path: ${value}`);
  return parts.join('/');
}

async function listFiles(root: string, current = root): Promise<string[]> {
  let entries;
  try { entries = await readdir(current, { withFileTypes: true }); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === '.gitkeep') continue;
    const path = resolve(current, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symbolic links are not allowed in backups: ${path}`);
    if (entry.isDirectory()) files.push(...await listFiles(root, path));
    else if (entry.isFile()) files.push(relative(root, path).split(sep).join('/'));
  }
  return files.sort((left, right) => left.localeCompare(right));
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

export async function createBackup(options: { contentRoot: string; outputPath: string; now?: Date }) {
  const contentRoot = resolve(options.contentRoot);
  const files = (await listFiles(contentRoot)).filter((path) => allowedTopLevel.has(path.split('/')[0]!));
  const manifest: BackupManifest = {
    version: 1,
    createdAt: (options.now ?? new Date()).toISOString(),
    files: [],
  };
  for (const path of files) {
    validateArchiveEntryPath(path);
    const absolute = resolve(contentRoot, path);
    const metadata = await stat(absolute);
    manifest.files.push({ path, byteSize: metadata.size, sha256: await sha256File(absolute) });
  }
  await mkdir(dirname(options.outputPath), { recursive: true });
  const zip = new ZipFile();
  for (const file of manifest.files) zip.addFile(resolve(contentRoot, file.path), file.path, { mode: 0o600 });
  zip.addBuffer(Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`), 'manifest.json', { mode: 0o600 });
  await new Promise<void>((resolvePromise, reject) => {
    zip.outputStream.pipe(createWriteStream(options.outputPath))
      .on('close', resolvePromise)
      .on('error', reject);
    zip.end();
  });
  return { manifest, fileCount: manifest.files.length, outputPath: options.outputPath };
}

function openEntry(zip: ReadZipFile, entry: Entry): Promise<NodeJS.ReadableStream> {
  return new Promise((resolvePromise, reject) => {
    zip.openReadStream(entry, (error, stream) => error || !stream ? reject(error ?? new Error('Missing ZIP stream.')) : resolvePromise(stream));
  });
}

function isSymlink(entry: Entry): boolean {
  return ((entry.externalFileAttributes >>> 16) & 0o170000) === 0o120000;
}

export async function validateBackup(options: {
  archivePath: string;
  stagingRoot: string;
  maxCompressedBytes?: number;
  maxExpandedBytes?: number;
  maxEntries?: number;
}): Promise<BackupCandidate> {
  const maxCompressed = options.maxCompressedBytes ?? 256 * 1024 * 1024;
  const maxExpanded = options.maxExpandedBytes ?? 1024 * 1024 * 1024;
  const maxEntries = options.maxEntries ?? 5000;
  if ((await stat(options.archivePath)).size > maxCompressed) throw new Error('Backup archive exceeds compressed size limit.');

  const stagingPath = resolve(options.stagingRoot, `candidate-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(stagingPath, { recursive: true });
  const zip = await openZip(options.archivePath, { lazyEntries: true, decodeStrings: true, validateEntrySizes: true });
  const seen = new Set<string>();
  let expanded = 0;
  let count = 0;

  try {
    await new Promise<void>((resolvePromise, reject) => {
      zip.on('error', reject);
      zip.on('end', resolvePromise);
      zip.on('entry', async (entry) => {
        try {
          count += 1;
          if (count > maxEntries) throw new Error('Backup archive contains too many entries.');
          const directory = entry.fileName.endsWith('/');
          const rawPath = directory ? entry.fileName.slice(0, -1) : entry.fileName;
          if (!rawPath) { zip.readEntry(); return; }
          const safePath = rawPath === 'manifest.json' ? rawPath : validateArchiveEntryPath(rawPath);
          if (seen.has(safePath)) throw new Error(`Duplicate archive entry: ${safePath}`);
          seen.add(safePath);
          if (isSymlink(entry)) throw new Error(`Symbolic link archive entry is forbidden: ${safePath}`);
          expanded += entry.uncompressedSize;
          if (expanded > maxExpanded) throw new Error('Backup archive exceeds expanded size limit.');
          const target = resolve(stagingPath, safePath);
          if (target !== stagingPath && !target.startsWith(`${stagingPath}${sep}`)) throw new Error(`Unsafe archive entry path: ${safePath}`);
          if (directory) await mkdir(target, { recursive: true });
          else {
            await mkdir(dirname(target), { recursive: true });
            const stream = await openEntry(zip, entry);
            await new Promise<void>((done, fail) => stream.pipe(createWriteStream(target, { mode: 0o600 })).on('close', done).on('error', fail));
          }
          zip.readEntry();
        } catch (error) { reject(error); }
      });
      zip.readEntry();
    });

    const manifest = JSON.parse(await readFile(resolve(stagingPath, 'manifest.json'), 'utf8')) as BackupManifest;
    if (manifest.version !== 1 || !Array.isArray(manifest.files)) throw new Error('Unsupported backup manifest.');
    const manifestPaths = new Set<string>();
    for (const file of manifest.files) {
      const path = validateArchiveEntryPath(file.path);
      if (manifestPaths.has(path)) throw new Error(`Duplicate manifest path: ${path}`);
      manifestPaths.add(path);
      if (!Number.isSafeInteger(file.byteSize) || file.byteSize < 0 || !/^[a-f0-9]{64}$/.test(file.sha256)) throw new Error(`Invalid manifest metadata: ${path}`);
      const target = resolve(stagingPath, path);
      const metadata = await stat(target);
      if (!metadata.isFile() || metadata.size !== file.byteSize || await sha256File(target) !== file.sha256) throw new Error(`Backup checksum mismatch: ${path}`);
    }
    const extractedFiles = (await listFiles(stagingPath)).filter((path) => path !== 'manifest.json');
    if (extractedFiles.length !== manifestPaths.size || extractedFiles.some((path) => !manifestPaths.has(path))) throw new Error('Backup manifest does not match archive contents.');
    return { stagingPath, manifest };
  } catch (error) {
    zip.close();
    await rm(stagingPath, { recursive: true, force: true });
    throw error;
  }
}

export async function installContentReplacement(options: {
  contentRoot: string;
  replacement: string;
  renamePath?: typeof rename;
}): Promise<void> {
  const contentRoot = resolve(options.contentRoot);
  const replacement = resolve(options.replacement);
  const previous = resolve(dirname(contentRoot), `.${randomUUID()}-content-previous`);
  const renamePath = options.renamePath ?? rename;
  await renamePath(contentRoot, previous);
  try {
    await renamePath(replacement, contentRoot);
  } catch (switchError) {
    try {
      await renamePath(previous, contentRoot);
    } catch (rollbackError) {
      throw new AggregateError(
        [switchError, rollbackError],
        'Backup apply and rollback both failed.',
      );
    }
    throw switchError;
  }
  await rm(previous, { recursive: true, force: true });
}

export async function applyBackup(options: { candidate: BackupCandidate; contentRoot: string; snapshotRoot: string; now?: Date }) {
  const stamp = (options.now ?? new Date()).toISOString().replace(/[:.]/g, '-');
  const snapshotPath = resolve(options.snapshotRoot, stamp);
  const contentRoot = resolve(options.contentRoot);
  const replacement = resolve(dirname(contentRoot), `.${Date.now()}-content-replacement`);
  await mkdir(dirname(snapshotPath), { recursive: true });
  await cp(contentRoot, snapshotPath, { recursive: true, force: false, errorOnExist: true });
  await mkdir(replacement, { recursive: true });
  for (const name of ['blog', 'clips', 'images']) {
    const source = resolve(options.candidate.stagingPath, name);
    try { await cp(source, resolve(replacement, name), { recursive: true, force: false, errorOnExist: true }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; await mkdir(resolve(replacement, name), { recursive: true }); }
  }
  try { await cp(resolve(options.candidate.stagingPath, 'redirects.json'), resolve(replacement, 'redirects.json')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  try {
    await installContentReplacement({ contentRoot, replacement });
  } finally {
    await rm(replacement, { recursive: true, force: true });
  }
  return { snapshotPath, contentRoot, manifest: options.candidate.manifest };
}
