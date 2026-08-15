import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';

export interface HistoryServiceOptions { database: DatabaseSync; blobRoot: string; maxVersions?: number; }
export interface RecordRevisionInput { contentPath: string; content: string; groupId: string; createdAt?: number; adminId?: number; }

export class HistoryService {
  private readonly maxVersions: number;
  constructor(private readonly options: HistoryServiceOptions) {
    this.maxVersions = options.maxVersions ?? 100;
    options.database.exec(`
      CREATE TABLE IF NOT EXISTS revision_metadata (
        revision_id INTEGER PRIMARY KEY REFERENCES revisions(id) ON DELETE CASCADE,
        group_id TEXT NOT NULL,
        blob_sha256 TEXT NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS revision_metadata_blob_idx ON revision_metadata(blob_sha256);
    `);
  }

  private async persistBlob(content: string): Promise<string> {
    const sha256 = createHash('sha256').update(content).digest('hex');
    await mkdir(this.options.blobRoot, { recursive: true });
    const path = resolve(this.options.blobRoot, sha256);
    await writeFile(path, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 }).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'EEXIST') throw error;
    });
    return sha256;
  }

  async record(input: RecordRevisionInput) {
    const blobSha256 = await this.persistBlob(input.content);
    const createdAt = input.createdAt ?? Date.now();
    const latest = this.options.database.prepare(`
      SELECT r.id, r.revision_number AS revisionNumber, m.group_id AS groupId
      FROM revisions r JOIN revision_metadata m ON m.revision_id = r.id
      WHERE r.content_path = ? ORDER BY r.revision_number DESC LIMIT 1
    `).get(input.contentPath) as { id: number; revisionNumber: number; groupId: string } | undefined;
    if (latest?.groupId === input.groupId) {
      this.options.database.exec('BEGIN IMMEDIATE');
      try {
        this.options.database.prepare(`
          UPDATE revisions
          SET content_sha256 = ?, created_by_admin_id = ?, created_at = ?
          WHERE id = ?
        `).run(blobSha256, input.adminId ?? null, createdAt, latest.id);
        this.options.database.prepare(`
          UPDATE revision_metadata SET blob_sha256 = ? WHERE revision_id = ?
        `).run(blobSha256, latest.id);
        this.options.database.exec('COMMIT');
        return {
          id: latest.id,
          revisionNumber: latest.revisionNumber,
          blobSha256,
          groupId: input.groupId,
          createdAt,
        };
      } catch (error) {
        this.options.database.exec('ROLLBACK');
        throw error;
      }
    }
    const revisionNumber = (latest?.revisionNumber ?? 0) + 1;
    this.options.database.exec('BEGIN IMMEDIATE');
    try {
      const result = this.options.database.prepare(`
        INSERT INTO revisions (content_path, revision_number, content_sha256, content, created_by_admin_id, created_at)
        VALUES (?, ?, ?, '', ?, ?)
      `).run(input.contentPath, revisionNumber, blobSha256, input.adminId ?? null, createdAt);
      this.options.database.prepare('INSERT INTO revision_metadata (revision_id, group_id, blob_sha256) VALUES (?, ?, ?)')
        .run(result.lastInsertRowid, input.groupId, blobSha256);
      this.options.database.prepare(`
        DELETE FROM revisions WHERE id IN (
          SELECT id FROM revisions WHERE content_path = ? ORDER BY revision_number DESC LIMIT -1 OFFSET ?
        )
      `).run(input.contentPath, this.maxVersions);
      this.options.database.exec('COMMIT');
      return { id: Number(result.lastInsertRowid), revisionNumber, blobSha256, groupId: input.groupId, createdAt };
    } catch (error) {
      this.options.database.exec('ROLLBACK');
      throw error;
    }
  }

  async readBlob(sha256: string) {
    if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error('Invalid history blob hash.');
    return readFile(resolve(this.options.blobRoot, sha256), 'utf8');
  }

  list(contentPath: string) {
    return this.options.database.prepare(`
      SELECT r.id, r.revision_number AS revisionNumber, r.content_sha256 AS blobSha256,
             r.created_at AS createdAt, m.group_id AS groupId
      FROM revisions r JOIN revision_metadata m ON m.revision_id = r.id
      WHERE r.content_path = ? ORDER BY r.revision_number DESC
    `).all(contentPath);
  }

  async restore(input: { contentPath: string; revisionNumber: number; createdAt?: number; adminId?: number; write(content: string): Promise<unknown> }) {
    const row = this.options.database.prepare(`
      SELECT r.content_sha256 AS blobSha256 FROM revisions r
      WHERE r.content_path = ? AND r.revision_number = ?
    `).get(input.contentPath, input.revisionNumber) as { blobSha256: string } | undefined;
    if (!row) throw new Error('Unknown content revision.');
    const content = await this.readBlob(row.blobSha256);
    await input.write(content);
    return this.record({ contentPath: input.contentPath, content, groupId: `restore-${randomUUID()}`, createdAt: input.createdAt, adminId: input.adminId });
  }
}
