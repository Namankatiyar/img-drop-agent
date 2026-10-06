import { Database } from 'bun:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import type { GroupRecord, ImageRecord, GroupWithImages, GroupStatus } from '@imgdrop/shared';

export function initDatabase(dbPath: string): Database {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath, { create: true });

  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');

  // Run initial migration
  const migrationFile = path.resolve(import.meta.dir, '../migrations/001_init.sql');
  if (fs.existsSync(migrationFile)) {
    const migrationSql = fs.readFileSync(migrationFile, 'utf-8');
    db.exec(migrationSql);
  } else {
    // Fallback inline schema in case migration file path is moved
    db.exec(`
      CREATE TABLE IF NOT EXISTS groups (
        id          TEXT PRIMARY KEY,
        created_at  TEXT NOT NULL,
        status      TEXT NOT NULL DEFAULT 'ready'
                    CHECK (status IN ('ready', 'claimed')),
        claimed_at  TEXT,
        note        TEXT,
        client_key  TEXT UNIQUE,
        image_count INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS images (
        id         TEXT PRIMARY KEY,
        group_id   TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        position   INTEGER NOT NULL,
        file_name  TEXT NOT NULL,
        mime       TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        UNIQUE (group_id, position)
      );

      CREATE INDEX IF NOT EXISTS idx_groups_status_id ON groups (status, id DESC);
    `);
  }

  return db;
}

export function getImagesForGroup(db: Database, groupId: string): ImageRecord[] {
  const stmt = db.query<ImageRecord, [string]>(`
    SELECT id, group_id, position, file_name, mime, size_bytes
    FROM images
    WHERE group_id = ?
    ORDER BY position ASC
  `);
  return stmt.all(groupId);
}

export function getGroupById(db: Database, id: string): GroupWithImages | null {
  const stmt = db.query<GroupRecord, [string]>(`
    SELECT id, created_at, status, claimed_at, note, client_key, image_count
    FROM groups
    WHERE id = ?
  `);
  const group = stmt.get(id);
  if (!group) return null;

  const images = getImagesForGroup(db, id);
  return { ...group, images };
}

export function getGroupByClientKey(db: Database, clientKey: string): GroupWithImages | null {
  const stmt = db.query<GroupRecord, [string]>(`
    SELECT id, created_at, status, claimed_at, note, client_key, image_count
    FROM groups
    WHERE client_key = ?
  `);
  const group = stmt.get(clientKey);
  if (!group) return null;

  const images = getImagesForGroup(db, group.id);
  return { ...group, images };
}

export function getLatestGroup(db: Database, unclaimedOnly = false): GroupWithImages | null {
  let query = `
    SELECT id, created_at, status, claimed_at, note, client_key, image_count
    FROM groups
  `;
  if (unclaimedOnly) {
    query += ` WHERE status = 'ready'`;
  }
  query += ` ORDER BY id DESC LIMIT 1`;

  const stmt = db.query<GroupRecord, []>(query);
  const group = stmt.get();
  if (!group) return null;

  const images = getImagesForGroup(db, group.id);
  return { ...group, images };
}

export function listGroups(
  db: Database,
  status?: GroupStatus,
  limit = 20
): GroupRecord[] {
  const safeLimit = Math.max(1, Math.min(limit, 100));
  if (status) {
    const stmt = db.query<GroupRecord, [GroupStatus, number]>(`
      SELECT id, created_at, status, claimed_at, note, client_key, image_count
      FROM groups
      WHERE status = ?
      ORDER BY id DESC
      LIMIT ?
    `);
    return stmt.all(status, safeLimit);
  }

  const stmt = db.query<GroupRecord, [number]>(`
    SELECT id, created_at, status, claimed_at, note, client_key, image_count
    FROM groups
    ORDER BY id DESC
    LIMIT ?
  `);
  return stmt.all(safeLimit);
}

export function insertGroupWithImages(
  db: Database,
  group: GroupRecord,
  images: ImageRecord[]
): void {
  const insertGroupStmt = db.prepare(`
    INSERT INTO groups (id, created_at, status, claimed_at, note, client_key, image_count)
    VALUES ($id, $created_at, $status, $claimed_at, $note, $client_key, $image_count)
  `);

  const insertImageStmt = db.prepare(`
    INSERT INTO images (id, group_id, position, file_name, mime, size_bytes)
    VALUES ($id, $group_id, $position, $file_name, $mime, $size_bytes)
  `);

  const transaction = db.transaction(() => {
    insertGroupStmt.run({
      $id: group.id,
      $created_at: group.created_at,
      $status: group.status,
      $claimed_at: group.claimed_at,
      $note: group.note,
      $client_key: group.client_key ?? null,
      $image_count: group.image_count,
    });

    for (const img of images) {
      insertImageStmt.run({
        $id: img.id,
        $group_id: img.group_id,
        $position: img.position,
        $file_name: img.file_name,
        $mime: img.mime,
        $size_bytes: img.size_bytes,
      });
    }
  });

  transaction();
}

export interface ClaimResult {
  status: 'claimed' | 'already_claimed' | 'not_found';
  group: GroupWithImages | null;
}

export function claimGroup(db: Database, id: string): ClaimResult {
  const existing = getGroupById(db, id);
  if (!existing) {
    return { status: 'not_found', group: null };
  }
  if (existing.status === 'claimed') {
    return { status: 'already_claimed', group: existing };
  }

  const now = new Date().toISOString();
  const updateStmt = db.prepare(`
    UPDATE groups
    SET status = 'claimed', claimed_at = ?
    WHERE id = ? AND status = 'ready'
  `);
  const result = updateStmt.run(now, id);

  if (result.changes > 0) {
    const updated = getGroupById(db, id);
    return { status: 'claimed', group: updated };
  }

  return { status: 'already_claimed', group: getGroupById(db, id) };
}

export interface ReleaseResult {
  status: 'released' | 'not_found';
  group: GroupWithImages | null;
}

export function releaseGroup(db: Database, id: string): ReleaseResult {
  const existing = getGroupById(db, id);
  if (!existing) {
    return { status: 'not_found', group: null };
  }

  if (existing.status !== 'ready') {
    const updateStmt = db.prepare(`
      UPDATE groups
      SET status = 'ready', claimed_at = NULL
      WHERE id = ? AND status = 'claimed'
    `);
    updateStmt.run(id);
  }

  return { status: 'released', group: getGroupById(db, id) };
}

export function deleteGroup(db: Database, id: string): boolean {
  const stmt = db.prepare(`DELETE FROM groups WHERE id = ?`);
  const result = stmt.run(id);
  return result.changes > 0;
}

export function listAllGroupIds(db: Database): string[] {
  const stmt = db.query<{ id: string }, []>(`SELECT id FROM groups`);
  const rows = stmt.all();
  return rows.map((r) => r.id);
}

export function pruneClaimedGroups(db: Database, olderThanDays: number): string[] {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
  
  const findStmt = db.query<{ id: string }, [string, string]>(`
    SELECT id FROM groups
    WHERE status = 'claimed' AND (claimed_at <= ? OR (claimed_at IS NULL AND created_at <= ?))
  `);
  const deleteStmt = db.prepare(`
    DELETE FROM groups
    WHERE status = 'claimed' AND (claimed_at <= ? OR (claimed_at IS NULL AND created_at <= ?))
  `);

  let idsToDelete: string[] = [];
  const txn = db.transaction(() => {
    const rows = findStmt.all(cutoff, cutoff);
    idsToDelete = rows.map((r) => r.id);
    if (idsToDelete.length > 0) {
      deleteStmt.run(cutoff, cutoff);
    }
  });
  txn();

  return idsToDelete;
}
