import { describe, it, expect, beforeEach, afterEach, afterAll } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import type { Database } from 'bun:sqlite';
import { initDatabase, insertGroupWithImages, getGroupById, pruneClaimedGroups } from '../src/db.ts';
import { getConfig } from '../src/config.ts';
import { ensureStorageDirs, cleanupDir } from '../src/storage.ts';

describe('Prune Maintenance Module', () => {
  const testDir = path.resolve(import.meta.dir, 'tmp_prune_test');
  const testConfig = getConfig({ dataDir: testDir });
  let db: Database;

  beforeEach(() => {
    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch {}

    ensureStorageDirs(testConfig);
    db = initDatabase(testConfig.dbFile);
  });

  afterEach(async () => {
    try {
      db.close();
    } catch {}

    await new Promise((resolve) => setTimeout(resolve, 80));
    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch {}
  });

  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch {}
  });

  it('prunes claimed groups older than cutoff and cascades to images', () => {
    const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    const freshDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Old claimed group (should be pruned)
    const oldClaimedId = '01JPRUNEOLDCLAIMED000000000';
    insertGroupWithImages(
      db,
      {
        id: oldClaimedId,
        created_at: oldDate,
        status: 'claimed',
        claimed_at: oldDate,
        note: 'Old claimed group',
        client_key: 'old-claimed-key',
        image_count: 1,
      },
      [
        {
          id: '01JPRUNEOLDIMG0000000000001',
          group_id: oldClaimedId,
          position: 1,
          file_name: '01.jpeg',
          mime: 'image/jpeg',
          size_bytes: 500,
        },
      ]
    );
    const oldDir = path.join(testConfig.storageDir, oldClaimedId);
    fs.mkdirSync(oldDir, { recursive: true });
    fs.writeFileSync(path.join(oldDir, '01.jpeg'), 'test');

    // 2. Fresh claimed group (should NOT be pruned)
    const freshClaimedId = '01JPRUNEFRESHCLAIM00000000';
    insertGroupWithImages(
      db,
      {
        id: freshClaimedId,
        created_at: freshDate,
        status: 'claimed',
        claimed_at: freshDate,
        note: 'Fresh claimed group',
        client_key: 'fresh-claimed-key',
        image_count: 1,
      },
      [
        {
          id: '01JPRUNEFRESHIMG00000000001',
          group_id: freshClaimedId,
          position: 1,
          file_name: '01.png',
          mime: 'image/png',
          size_bytes: 800,
        },
      ]
    );

    // 3. Old ready group (should NOT be pruned - only claimed groups are pruned)
    const oldReadyId = '01JPRUNEOLDREADY0000000000';
    insertGroupWithImages(
      db,
      {
        id: oldReadyId,
        created_at: oldDate,
        status: 'ready',
        claimed_at: null,
        note: 'Old ready group',
        client_key: null,
        image_count: 0,
      },
      []
    );

    // Run prune for groups older than 30 days
    const prunedIds = pruneClaimedGroups(db, 30);

    expect(prunedIds).toContain(oldClaimedId);
    expect(prunedIds).not.toContain(freshClaimedId);
    expect(prunedIds).not.toContain(oldReadyId);
    expect(prunedIds.length).toBe(1);

    // Verify database records
    expect(getGroupById(db, oldClaimedId)).toBeNull();
    expect(getGroupById(db, freshClaimedId)).not.toBeNull();
    expect(getGroupById(db, oldReadyId)).not.toBeNull();

    // Verify cascade: images for old group are deleted
    const imgCheck = db.query('SELECT * FROM images WHERE group_id = ?').all(oldClaimedId);
    expect(imgCheck.length).toBe(0);

    // Simulate disk cleanup
    for (const id of prunedIds) {
      cleanupDir(path.join(testConfig.storageDir, id));
    }
    expect(fs.existsSync(oldDir)).toBe(false);
  });
});
