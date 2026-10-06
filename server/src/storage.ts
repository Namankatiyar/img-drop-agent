import fs from 'node:fs';
import path from 'node:path';
import type { Database } from 'bun:sqlite';
import type { Config } from './types.ts';
import { listAllGroupIds } from './db.ts';

export interface ImageTypeInfo {
  mime: string;
  ext: string;
}

export function sniffImageType(buf: Buffer | Uint8Array): ImageTypeInfo | null {
  if (buf.length < 3) {
    return null;
  }

  // JPEG: 0xFF, 0xD8, 0xFF (requires at least 3 bytes)
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpeg' };
  }

  // PNG: 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A (requires at least 8 bytes)
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { mime: 'image/png', ext: 'png' };
  }

  // WebP: RIFF (0..3) ... WEBP (8..11) (requires at least 12 bytes)
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return { mime: 'image/webp', ext: 'webp' };
  }

  return null;
}

export function sniffImageFileSync(filePath: string): ImageTypeInfo | null {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.alloc(12);
    const bytesRead = fs.readSync(fd, buffer, 0, 12, 0);
    if (bytesRead < 3) {
      return null;
    }
    return sniffImageType(buffer.subarray(0, bytesRead));
  } finally {
    fs.closeSync(fd);
  }
}

export function ensureStorageDirs(cfg: Config): void {
  if (!fs.existsSync(cfg.dataDir)) {
    fs.mkdirSync(cfg.dataDir, { recursive: true });
  }
  if (!fs.existsSync(cfg.storageDir)) {
    fs.mkdirSync(cfg.storageDir, { recursive: true });
  }
  if (!fs.existsSync(cfg.tmpDir)) {
    fs.mkdirSync(cfg.tmpDir, { recursive: true });
  }
}

export function cleanupDir(dirPath: string): void {
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  } catch (err) {
    console.error(`[Storage] Failed to cleanup directory: ${dirPath}`, err);
  }
}

export function atomicMoveDirectory(sourceDir: string, targetDir: string): void {
  const parent = path.dirname(targetDir);
  if (!fs.existsSync(parent)) {
    fs.mkdirSync(parent, { recursive: true });
  }

  // If targetDir already exists (e.g. from prior failed run), clean it up first
  if (fs.existsSync(targetDir)) {
    cleanupDir(targetDir);
  }

  try {
    fs.renameSync(sourceDir, targetDir);
  } catch (err: any) {
    // Cross-device or Windows locked rename fallback
    try {
      fs.cpSync(sourceDir, targetDir, { recursive: true });
      fs.rmSync(sourceDir, { recursive: true, force: true });
    } catch (fallbackErr) {
      cleanupDir(targetDir);
      throw fallbackErr;
    }
  }
}

export function sweepOrphans(cfg: Config, db: Database, maxAgeMs = 60_000): {
  removedTmpCount: number;
  removedOrphanDirCount: number;
} {
  let removedTmpCount = 0;
  let removedOrphanDirCount = 0;

  // 1. Sweep .tmp directory completely
  if (fs.existsSync(cfg.tmpDir)) {
    try {
      const tmpEntries = fs.readdirSync(cfg.tmpDir);
      for (const entry of tmpEntries) {
        const fullPath = path.join(cfg.tmpDir, entry);
        cleanupDir(fullPath);
        removedTmpCount++;
      }
    } catch (err) {
      console.error(`[Storage] Error sweeping tmp directory:`, err);
    }
  }

  // 2. Sweep storage directory for unindexed dirs older than maxAgeMs
  if (fs.existsSync(cfg.storageDir)) {
    try {
      const validGroupIds = new Set(listAllGroupIds(db));
      const storageEntries = fs.readdirSync(cfg.storageDir, { withFileTypes: true });

      const now = Date.now();
      for (const entry of storageEntries) {
        if (!entry.isDirectory() || entry.name === '.tmp') {
          continue;
        }

        const groupId = entry.name;
        if (!validGroupIds.has(groupId)) {
          const dirPath = path.join(cfg.storageDir, groupId);
          try {
            const stats = fs.statSync(dirPath);
            const ageMs = now - stats.mtimeMs;
            if (ageMs >= maxAgeMs) {
              cleanupDir(dirPath);
              removedOrphanDirCount++;
            }
          } catch {
            // Stat failed, skip
          }
        }
      }
    } catch (err) {
      console.error(`[Storage] Error sweeping storage directory:`, err);
    }
  }

  return { removedTmpCount, removedOrphanDirCount };
}
