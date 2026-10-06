import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import type { Database } from 'bun:sqlite';
import { createApp } from '../src/app.ts';
import { initDatabase } from '../src/db.ts';
import { getConfig } from '../src/config.ts';
import { ensureStorageDirs } from '../src/storage.ts';

describe('ImgDrop REST API Integration Tests', () => {
  const testDir = path.resolve(import.meta.dir, 'tmp_api_test');
  const testConfig = getConfig({
    dataDir: testDir,
    port: 0,
    maxFiles: 5,
    maxFileMb: 1,
    maxRequestMb: 2,
  });

  const testCredentials = {
    server_id: 'server_test_id_999',
    token: 'b'.repeat(64),
  };

  let server: http.Server;
  let baseUrl: string;
  let db: Database;

  // Image buffers
  const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
  const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  const webpBytes = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
  const invalidBytes = Buffer.from('Plain text file content, definitely not an image.');

  beforeAll(async () => {
    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch {}

    ensureStorageDirs(testConfig);
    db = initDatabase(testConfig.dbFile);

    const app = createApp({ db, config: testConfig, credentials: testCredentials });
    server = http.createServer(app);

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });

    try {
      db.close();
    } catch {}

    // Wait for Windows file handles to release
    await new Promise((resolve) => setTimeout(resolve, 80));
    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch {}
  });

  // 1. Health endpoint
  describe('GET /health', () => {
    it('returns 200 without authentication', async () => {
      const res = await fetch(`${baseUrl}/health`);
      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.status).toBe('ok');
      expect(data.server_id).toBe(testCredentials.server_id);
      expect(data.version).toBe('1.0.0');
    });
  });

  // 2. Authentication enforcement
  describe('Authentication Enforcement', () => {
    it('returns 401 when no token is provided', async () => {
      const res = await fetch(`${baseUrl}/groups`);
      expect(res.status).toBe(401);
      const data: any = await res.json();
      expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 when wrong token is provided', async () => {
      const res = await fetch(`${baseUrl}/groups`, {
        headers: { Authorization: 'Bearer wrong-token' },
      });
      expect(res.status).toBe(401);
      const data: any = await res.json();
      expect(data.error.code).toBe('UNAUTHORIZED');
    });
  });

  // 3. Upload & Groups Lifecycle
  describe('POST /groups & Lifecycle', () => {
    let createdGroupId: string;

    it('returns 204 when getting latest with no groups present', async () => {
      const res = await fetch(`${baseUrl}/groups/latest`, {
        headers: { Authorization: `Bearer ${testCredentials.token}` },
      });
      expect(res.status).toBe(204);
    });

    it('uploads valid images and creates group', async () => {
      const formData = new FormData();
      formData.append('images', new Blob([jpegBytes], { type: 'image/jpeg' }), 'photo1.jpg');
      formData.append('images', new Blob([pngBytes], { type: 'image/png' }), 'photo2.png');
      formData.append('images', new Blob([webpBytes], { type: 'image/webp' }), 'photo3.webp');
      formData.append('note', 'Batch upload test');

      const res = await fetch(`${baseUrl}/groups`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${testCredentials.token}`,
          'Idempotency-Key': 'idemp-key-100',
        },
        body: formData,
      });

      expect(res.status).toBe(201);
      const body: any = await res.json();
      expect(body.id).toBeDefined();
      expect(body.status).toBe('ready');
      expect(body.image_count).toBe(3);
      expect(body.note).toBe('Batch upload test');
      expect(body.client_key).toBe('idemp-key-100');
      expect(body.images.length).toBe(3);

      createdGroupId = body.id;

      // Verify files created on disk
      expect(fs.existsSync(path.join(testConfig.storageDir, createdGroupId, '01.jpeg'))).toBe(true);
      expect(fs.existsSync(path.join(testConfig.storageDir, createdGroupId, '02.png'))).toBe(true);
      expect(fs.existsSync(path.join(testConfig.storageDir, createdGroupId, '03.webp'))).toBe(true);
    });

    it('handles idempotent retries gracefully returning 200 with existing group', async () => {
      const formData = new FormData();
      formData.append('images', new Blob([jpegBytes]), 'photo1.jpg');

      const res = await fetch(`${baseUrl}/groups`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${testCredentials.token}`,
          'Idempotency-Key': 'idemp-key-100', // same key
        },
        body: formData,
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.id).toBe(createdGroupId);
      expect(body.image_count).toBe(3);
    });

    it('rejects upload with invalid magic bytes (415)', async () => {
      const formData = new FormData();
      formData.append('images', new Blob([invalidBytes]), 'bad.txt');

      const res = await fetch(`${baseUrl}/groups`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${testCredentials.token}`,
        },
        body: formData,
      });

      expect(res.status).toBe(415);
      const body: any = await res.json();
      expect(body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });

    it('rejects upload with no images (400)', async () => {
      const formData = new FormData();
      formData.append('note', 'No images attached');

      const res = await fetch(`${baseUrl}/groups`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${testCredentials.token}`,
        },
        body: formData,
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects upload when note exceeds 2000 chars (400)', async () => {
      const formData = new FormData();
      formData.append('images', new Blob([pngBytes]), 'p.png');
      formData.append('note', 'a'.repeat(2001));

      const res = await fetch(`${baseUrl}/groups`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${testCredentials.token}`,
        },
        body: formData,
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('GET /groups/latest retrieves the newest group', async () => {
      const res = await fetch(`${baseUrl}/groups/latest?unclaimed=1`, {
        headers: { Authorization: `Bearer ${testCredentials.token}` },
      });
      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.id).toBe(createdGroupId);
      expect(data.status).toBe('ready');
      expect(data.images.length).toBe(3);
    });

    it('GET /groups lists groups with status filter', async () => {
      const res = await fetch(`${baseUrl}/groups?status=ready&limit=10`, {
        headers: { Authorization: `Bearer ${testCredentials.token}` },
      });
      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(Array.isArray(data.groups)).toBe(true);
      expect(data.groups.length).toBeGreaterThan(0);
      expect(data.groups[0].id).toBe(createdGroupId);
    });

    it('GET /groups/:id returns group details', async () => {
      const res = await fetch(`${baseUrl}/groups/${createdGroupId}`, {
        headers: { Authorization: `Bearer ${testCredentials.token}` },
      });
      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.id).toBe(createdGroupId);
      expect(data.images.length).toBe(3);
    });

    it('GET /groups/:id returns 404 for non-existent ULID', async () => {
      const dummyUlid = '01JZZZZZZZZZZZZZZZZZZZZZZZ';
      const res = await fetch(`${baseUrl}/groups/${dummyUlid}`, {
        headers: { Authorization: `Bearer ${testCredentials.token}` },
      });
      expect(res.status).toBe(404);
      const data: any = await res.json();
      expect(data.error.code).toBe('NOT_FOUND');
    });

    it('GET /groups/:id returns 400 for invalid ULID format', async () => {
      const res = await fetch(`${baseUrl}/groups/bad-id`, {
        headers: { Authorization: `Bearer ${testCredentials.token}` },
      });
      expect(res.status).toBe(400);
    });

    it('GET /groups/:id/images/:position streams the image correctly', async () => {
      const res = await fetch(`${baseUrl}/groups/${createdGroupId}/images/1`, {
        headers: { Authorization: `Bearer ${testCredentials.token}` },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('image/jpeg');
      const blob = await res.blob();
      expect(blob.size).toBe(jpegBytes.length);
    });

    it('GET /groups/:id/images/:position returns 404 for invalid position', async () => {
      const res = await fetch(`${baseUrl}/groups/${createdGroupId}/images/99`, {
        headers: { Authorization: `Bearer ${testCredentials.token}` },
      });
      expect(res.status).toBe(404);
    });

    it('POST /groups/:id/claim marks group as claimed', async () => {
      const res = await fetch(`${baseUrl}/groups/${createdGroupId}/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${testCredentials.token}` },
      });
      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.status).toBe('claimed');
      expect(data.claimed_at).not.toBeNull();
    });

    it('POST /groups/:id/claim on already claimed group returns 409 Conflict', async () => {
      const res = await fetch(`${baseUrl}/groups/${createdGroupId}/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${testCredentials.token}` },
      });
      expect(res.status).toBe(409);
      const data: any = await res.json();
      expect(data.error.code).toBe('CONFLICT');
    });

    it('GET /groups/latest?unclaimed=1 returns 204 after all groups are claimed', async () => {
      const res = await fetch(`${baseUrl}/groups/latest?unclaimed=1`, {
        headers: { Authorization: `Bearer ${testCredentials.token}` },
      });
      expect(res.status).toBe(204);
    });

    it('POST /groups/:id/release reverts status back to ready', async () => {
      const res = await fetch(`${baseUrl}/groups/${createdGroupId}/release`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${testCredentials.token}` },
      });
      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.status).toBe('ready');
      expect(data.claimed_at).toBeNull();
    });

    it('handles concurrent POST /groups with identical Idempotency-Key safely', async () => {
      const makeReq = () => {
        const formData = new FormData();
        formData.append('images', new Blob([jpegBytes], { type: 'image/jpeg' }), 'race.jpg');
        return fetch(`${baseUrl}/groups`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${testCredentials.token}`,
            'Idempotency-Key': 'race-condition-key-99',
          },
          body: formData,
        });
      };

      const [res1, res2] = await Promise.all([makeReq(), makeReq()]);
      const statuses = [res1.status, res2.status].sort();
      // One creates (201), the concurrent duplicate returns existing (200)
      expect(statuses).toEqual([200, 201]);

      const body1: any = await res1.json();
      const body2: any = await res2.json();
      expect(body1.id).toBe(body2.id);
      expect(body1.client_key).toBe('race-condition-key-99');
    });

    it('rejects upload exceeding maxFiles limit with 413', async () => {
      const formData = new FormData();
      // testConfig.maxFiles is 5, so sending 6 files exceeds limit
      for (let i = 0; i < 6; i++) {
        formData.append('images', new Blob([jpegBytes], { type: 'image/jpeg' }), `img_${i}.jpg`);
      }

      const res = await fetch(`${baseUrl}/groups`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${testCredentials.token}` },
        body: formData,
      });

      expect(res.status).toBe(413);
      const body: any = await res.json();
      expect(body.error.code).toBe('LIMIT_FILE_COUNT');
    });

    it('rejects upload exceeding maxRequestMb limit with 413', async () => {
      // testConfig.maxRequestMb is 2 MB. Send 2 files of 1.2 MB each = 2.4 MB
      const largeBlob = new Uint8Array(1.2 * 1024 * 1024);
      largeBlob[0] = 0xff;
      largeBlob[1] = 0xd8;
      largeBlob[2] = 0xff;
      largeBlob[3] = 0xe0;

      const formData = new FormData();
      formData.append('images', new Blob([largeBlob], { type: 'image/jpeg' }), 'large1.jpg');
      formData.append('images', new Blob([largeBlob], { type: 'image/jpeg' }), 'large2.jpg');

      const res = await fetch(`${baseUrl}/groups`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${testCredentials.token}` },
        body: formData,
      });

      expect(res.status).toBe(413);
      const body: any = await res.json();
      expect(body.error.code).toBe('PAYLOAD_TOO_LARGE');
    });

    it('GET /groups returns 400 for invalid status', async () => {
      const res = await fetch(`${baseUrl}/groups?status=invalid_status`, {
        headers: { Authorization: `Bearer ${testCredentials.token}` },
      });
      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('GET /groups returns 400 for invalid limit', async () => {
      const res = await fetch(`${baseUrl}/groups?limit=-5`, {
        headers: { Authorization: `Bearer ${testCredentials.token}` },
      });
      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('POST /groups/:id/claim returns 404 for non-existent ULID', async () => {
      const dummyUlid = '01JZZZZZZZZZZZZZZZZZZZZZZZ';
      const res = await fetch(`${baseUrl}/groups/${dummyUlid}/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${testCredentials.token}` },
      });
      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('POST /groups/:id/release returns 404 for non-existent ULID', async () => {
      const dummyUlid = '01JZZZZZZZZZZZZZZZZZZZZZZZ';
      const res = await fetch(`${baseUrl}/groups/${dummyUlid}/release`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${testCredentials.token}` },
      });
      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('GET /groups/:id/images/:position returns 400 for non-positive or non-integer position', async () => {
      const res1 = await fetch(`${baseUrl}/groups/${createdGroupId}/images/0`, {
        headers: { Authorization: `Bearer ${testCredentials.token}` },
      });
      expect(res1.status).toBe(400);

      const res2 = await fetch(`${baseUrl}/groups/${createdGroupId}/images/abc`, {
        headers: { Authorization: `Bearer ${testCredentials.token}` },
      });
      expect(res2.status).toBe(400);
    });

    it('GET /groups/:id/images/:position returns 404 when file is missing from disk', async () => {
      const filePath = path.join(testConfig.storageDir, createdGroupId, '01.jpeg');
      const backupPath = path.join(testConfig.storageDir, createdGroupId, '01.jpeg.bak');
      fs.renameSync(filePath, backupPath);

      try {
        const res = await fetch(`${baseUrl}/groups/${createdGroupId}/images/1`, {
          headers: { Authorization: `Bearer ${testCredentials.token}` },
        });
        expect(res.status).toBe(404);
        const body: any = await res.json();
        expect(body.error.code).toBe('NOT_FOUND');
      } finally {
        fs.renameSync(backupPath, filePath);
      }
    });
  });
});
