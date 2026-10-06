import { describe, it, expect, beforeEach, afterEach, afterAll } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import {
  sniffImageType,
  sniffImageFileSync,
  atomicMoveDirectory,
  sweepOrphans,
  ensureStorageDirs,
} from '../src/storage.ts';
import { initDatabase, insertGroupWithImages } from '../src/db.ts';
import { getConfig } from '../src/config.ts';

describe('Storage Module', () => {
  const testDir = path.resolve(import.meta.dir, 'tmp_storage_test');
  const testConfig = getConfig({ dataDir: testDir });

  let activeDb: any = null;

  beforeEach(() => {
    activeDb = null;
    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch {}
    ensureStorageDirs(testConfig);
  });

  afterEach(async () => {
    if (activeDb) {
      try {
        activeDb.close();
      } catch {}
      activeDb = null;
    }
    // Small delay for Windows lock release
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

  describe('sniffImageType', () => {
    it('correctly detects WebP magic bytes', () => {
      const webpBuf = Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
      expect(sniffImageType(webpBuf)).toEqual({ mime: 'image/webp', ext: 'webp' });
    });

    it('correctly detects JPEG magic bytes', () => {
      const jpegBuf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 0]);
      expect(sniffImageType(jpegBuf)).toEqual({ mime: 'image/jpeg', ext: 'jpeg' });
    });

    it('correctly detects PNG magic bytes', () => {
      const pngBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
      expect(sniffImageType(pngBuf)).toEqual({ mime: 'image/png', ext: 'png' });
    });

    it('returns null for buffers shorter than 3 bytes', () => {
      const shortBuf = Buffer.from([0xff, 0xd8]);
      expect(sniffImageType(shortBuf)).toBeNull();
      expect(sniffImageType(Buffer.alloc(0))).toBeNull();
    });

    it('detects minimal 3-byte JPEG magic buffer', () => {
      const minimalJpeg = Buffer.from([0xff, 0xd8, 0xff]);
      expect(sniffImageType(minimalJpeg)).toEqual({ mime: 'image/jpeg', ext: 'jpeg' });
    });

    it('detects minimal 8-byte PNG magic buffer', () => {
      const minimalPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(sniffImageType(minimalPng)).toEqual({ mime: 'image/png', ext: 'png' });
    });

    it('rejects truncated 10-byte WebP header missing WEBP marker', () => {
      const truncatedWebp = Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45]);
      expect(sniffImageType(truncatedWebp)).toBeNull();
    });

    it('returns null for arbitrary non-image text', () => {
      const textBuf = Buffer.from('Hello world! This is a text file.');
      expect(sniffImageType(textBuf)).toBeNull();
    });

    it('sniffImageFileSync works with real files', () => {
      const testFile = path.join(testDir, 'sample.png');
      const pngBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
      fs.writeFileSync(testFile, pngBuf);

      const detected = sniffImageFileSync(testFile);
      expect(detected).toEqual({ mime: 'image/png', ext: 'png' });
    });
  });

  describe('atomicMoveDirectory', () => {
    it('moves directory contents atomically', () => {
      const srcDir = path.join(testConfig.tmpDir, 'source_grp');
      const destDir = path.join(testConfig.storageDir, 'dest_grp');
      fs.mkdirSync(srcDir, { recursive: true });

      const sampleFile = path.join(srcDir, '01.png');
      fs.writeFileSync(sampleFile, 'dummy image data');

      atomicMoveDirectory(srcDir, destDir);

      expect(fs.existsSync(srcDir)).toBe(false);
      expect(fs.existsSync(destDir)).toBe(true);
      expect(fs.readFileSync(path.join(destDir, '01.png'), 'utf-8')).toBe('dummy image data');
    });
  });

  describe('sweepOrphans', () => {
    it('cleans up .tmp directories and old unindexed storage folders', () => {
      const db = initDatabase(testConfig.dbFile);
      activeDb = db;

      // 1. Create a valid group in db and storage
      const validGroupId = '01JABCDEFGHJKMNPQRSTUVWXY1';
      insertGroupWithImages(
        db,
        {
          id: validGroupId,
          created_at: new Date().toISOString(),
          status: 'ready',
          claimed_at: null,
          note: null,
          client_key: null,
          image_count: 0,
        },
        []
      );
      const validStorageDir = path.join(testConfig.storageDir, validGroupId);
      fs.mkdirSync(validStorageDir, { recursive: true });

      // 2. Create an orphaned .tmp directory
      const tmpOrphanDir = path.join(testConfig.tmpDir, 'tmp_orphan_123');
      fs.mkdirSync(tmpOrphanDir, { recursive: true });

      // 3. Create an unindexed storage directory with an old mtime (>60s ago)
      const unindexedOldDir = path.join(testConfig.storageDir, 'unindexed_old_456');
      fs.mkdirSync(unindexedOldDir, { recursive: true });
      const oldTime = (Date.now() - 120_000) / 1000;
      fs.utimesSync(unindexedOldDir, oldTime, oldTime);

      // 4. Create an unindexed storage directory that is fresh (<60s ago)
      const unindexedNewDir = path.join(testConfig.storageDir, 'unindexed_fresh_789');
      fs.mkdirSync(unindexedNewDir, { recursive: true });

      // Run sweep
      const stats = sweepOrphans(testConfig, db, 60_000);

      expect(stats.removedTmpCount).toBe(1);
      expect(stats.removedOrphanDirCount).toBe(1);

      expect(fs.existsSync(tmpOrphanDir)).toBe(false);
      expect(fs.existsSync(unindexedOldDir)).toBe(false);
      expect(fs.existsSync(validStorageDir)).toBe(true);
      expect(fs.existsSync(unindexedNewDir)).toBe(true);

      db.close();
    });
  });
});
