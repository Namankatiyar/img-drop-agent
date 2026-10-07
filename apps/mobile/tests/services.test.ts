import { describe, expect, it, beforeEach } from 'bun:test';
import {
  TARGET_LONG_EDGE_PX,
  WEBP_QUALITY,
  MAX_NOTE_LENGTH,
  BEACON_PORT,
  type PairingCredentials,
} from '@imgdrop/shared';

import {
  calculateTargetDimensions,
  processImage,
  setImageManipulatorDriver,
} from '../src/services/imageProcessor';

import {
  generateIdempotencyKey,
  validateNote,
  uploadGroup,
  ApiUploadError,
  setApiTransportDriver,
} from '../src/services/api';

import {
  isValidBeaconPayload,
  isValidHealthResponse,
  extractSubnetBase,
} from '../src/services/discovery';

import {
  saveCredentials,
  getCredentials,
  clearCredentials,
  resetStorageForTesting,
  setStorageDriver,
} from '../src/services/storage';

describe('ImgDrop Mobile Services Test Suite', () => {
  beforeEach(() => {
    resetStorageForTesting();
    setImageManipulatorDriver(null);
    setApiTransportDriver(null);
  });

  // =========================================================================
  // 1. Image Dimension Calculations & Processing (Section 10)
  // =========================================================================
  describe('Image Dimensions & Processing', () => {
    it('scales down large landscape image so long edge equals TARGET_LONG_EDGE_PX (1568px)', () => {
      // 4000x3000 -> scale = 1568 / 4000 = 0.392
      const target = calculateTargetDimensions(4000, 3000);
      expect(target.width).toBe(TARGET_LONG_EDGE_PX);
      expect(target.height).toBe(Math.round(3000 * (TARGET_LONG_EDGE_PX / 4000)));
      expect(target.height).toBe(1176);
      expect(Math.max(target.width, target.height)).toBeLessThanOrEqual(TARGET_LONG_EDGE_PX);
    });

    it('scales down large portrait image so long edge equals TARGET_LONG_EDGE_PX (1568px)', () => {
      // 3000x4000 -> scale = 1568 / 4000 = 0.392
      const target = calculateTargetDimensions(3000, 4000);
      expect(target.height).toBe(TARGET_LONG_EDGE_PX);
      expect(target.width).toBe(1176);
      expect(Math.max(target.width, target.height)).toBeLessThanOrEqual(TARGET_LONG_EDGE_PX);
    });

    it('scales down large square image preserving 1:1 aspect ratio', () => {
      const target = calculateTargetDimensions(2000, 2000);
      expect(target.width).toBe(TARGET_LONG_EDGE_PX);
      expect(target.height).toBe(TARGET_LONG_EDGE_PX);
    });

    it('never upscales images with long edge strictly less than TARGET_LONG_EDGE_PX', () => {
      // Smaller landscape: 1200x800
      const landscape = calculateTargetDimensions(1200, 800);
      expect(landscape.width).toBe(1200);
      expect(landscape.height).toBe(800);

      // Smaller portrait: 800x1200
      const portrait = calculateTargetDimensions(800, 1200);
      expect(portrait.width).toBe(800);
      expect(portrait.height).toBe(1200);

      // Tiny square: 100x100
      const tiny = calculateTargetDimensions(100, 100);
      expect(tiny.width).toBe(100);
      expect(tiny.height).toBe(100);
    });

    it('preserves exact dimensions when long edge is exactly TARGET_LONG_EDGE_PX', () => {
      const boundaryLandscape = calculateTargetDimensions(1568, 1000);
      expect(boundaryLandscape.width).toBe(1568);
      expect(boundaryLandscape.height).toBe(1000);

      const boundarySquare = calculateTargetDimensions(1568, 1568);
      expect(boundarySquare.width).toBe(1568);
      expect(boundarySquare.height).toBe(1568);
    });

    it('supports custom maxLongEdge parameter', () => {
      const custom = calculateTargetDimensions(1000, 500, 800);
      expect(custom.width).toBe(800);
      expect(custom.height).toBe(400);
    });

    it('throws on non-positive or invalid dimensions', () => {
      expect(() => calculateTargetDimensions(0, 100)).toThrow();
      expect(() => calculateTargetDimensions(100, -50)).toThrow();
      expect(() => calculateTargetDimensions(NaN, 100)).toThrow();
      expect(() => calculateTargetDimensions(100, Infinity)).toThrow();
    });

    it('processes image with WebP encoding and fallback to JPEG if WebP fails', async () => {
      // Test WebP success with mock driver
      let webpAttempted = false;
      let jpegAttempted = false;
      let capturedActions: any[] = [];
      let capturedSaveOptions: any = null;

      setImageManipulatorDriver({
        async manipulate(uri, actions, saveOptions) {
          capturedActions = actions;
          capturedSaveOptions = saveOptions;
          if (saveOptions.format === 'webp') {
            webpAttempted = true;
            return { uri: 'file:///tmp/output.webp', width: 4000, height: 3000 };
          }
          jpegAttempted = true;
          return { uri: 'file:///tmp/output.jpg', width: 4000, height: 3000 };
        },
      });

      const resWebp = await processImage('file:///input.jpg', { width: 4000, height: 3000 });
      expect(webpAttempted).toBe(true);
      expect(resWebp.mime).toBe('image/webp');
      expect(resWebp.width).toBe(4000);
      expect(resWebp.height).toBe(3000);
      expect(capturedActions).toEqual([]); // No resize actions: preserves full resolution
      expect(capturedSaveOptions.compress).toBe(1.0); // 100% quality (no quality loss)

      // Now test fallback to JPEG when WebP throws
      setImageManipulatorDriver({
        async manipulate(uri, actions, saveOptions) {
          if (saveOptions.format === 'webp') {
            throw new Error('WebP unsupported on this native version');
          }
          jpegAttempted = true;
          return { uri: 'file:///tmp/fallback.jpg', width: 4000, height: 3000 };
        },
      });

      const resJpeg = await processImage('file:///input.jpg', { width: 4000, height: 3000 });
      expect(jpegAttempted).toBe(true);
      expect(resJpeg.mime).toBe('image/jpeg');
      expect(resJpeg.width).toBe(4000);
      expect(resJpeg.height).toBe(3000);
    });

    it('preserves full image resolution and maximum quality (1.0) without downscaling', async () => {
      let passedActions: any[] = [];
      let passedSaveOptions: any = null;

      setImageManipulatorDriver({
        async manipulate(_uri, actions, saveOptions) {
          passedActions = actions;
          passedSaveOptions = saveOptions;
          return { uri: 'file:///tmp/hires.webp', width: 4032, height: 3024 };
        },
      });

      const result = await processImage('file:///input_4k.jpg', { width: 4032, height: 3024 });
      expect(result.width).toBe(4032);
      expect(result.height).toBe(3024);
      expect(result.mime).toBe('image/webp');
      expect(passedActions).toEqual([]); // No resizing actions added
      expect(passedSaveOptions.compress).toBe(1.0); // 100% quality (no loss)
      expect(passedSaveOptions.format).toBe('webp');
    });
  });

  // =========================================================================
  // 2. Idempotency Key, Note Validation & API Upload
  // =========================================================================
  describe('Idempotency & API Upload', () => {
    it('generates a valid RFC4122 v4 UUID for idempotency key', () => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const key1 = generateIdempotencyKey();
      const key2 = generateIdempotencyKey();

      expect(key1).toMatch(uuidRegex);
      expect(key2).toMatch(uuidRegex);
      expect(key1).not.toBe(key2);
    });

    it('validates note length according to MAX_NOTE_LENGTH (2000 chars)', () => {
      expect(() => validateNote(undefined)).not.toThrow();
      expect(() => validateNote('')).not.toThrow();
      expect(() => validateNote('Short note')).not.toThrow();
      expect(() => validateNote('A'.repeat(MAX_NOTE_LENGTH))).not.toThrow();

      // Exceeding MAX_NOTE_LENGTH
      expect(() => validateNote('A'.repeat(MAX_NOTE_LENGTH + 1))).toThrow(
        /exceeds maximum permitted length/
      );
    });

    it('preserves specified Idempotency-Key across retries', async () => {
      const fixedKey = '12345678-1234-4234-8234-123456789abc';
      let capturedHeaderKey = '';

      setApiTransportDriver({
        async upload(url, formData, headers) {
          capturedHeaderKey = headers['Idempotency-Key'];
          return {
            status: 201,
            text: JSON.stringify({
              id: '01JABCDEF123456',
              created_at: new Date().toISOString(),
              status: 'ready',
              image_count: 1,
            }),
          };
        },
      });

      const result = await uploadGroup({
        host: '127.0.0.1',
        port: 8000,
        token: 'test_token',
        images: [{ uri: 'file:///photo.webp' }],
        idempotencyKey: fixedKey,
      });

      expect(result.idempotencyKey).toBe(fixedKey);
      expect(capturedHeaderKey).toBe(fixedKey);
    });

    it('retains the identical Idempotency-Key on upload failure via ApiUploadError', async () => {
      const fixedKey = '87654321-4321-4321-9321-cba987654321';

      setApiTransportDriver({
        async upload() {
          return {
            status: 500,
            text: JSON.stringify({ error: { code: 'SERVER_ERROR', message: 'Internal error' } }),
          };
        },
      });

      let caughtError: ApiUploadError | null = null;
      try {
        await uploadGroup({
          host: '127.0.0.1',
          port: 8000,
          token: 'test_token',
          images: [{ uri: 'file:///photo.webp' }],
          idempotencyKey: fixedKey,
        });
      } catch (err) {
        if (err instanceof ApiUploadError) {
          caughtError = err;
        }
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError?.idempotencyKey).toBe(fixedKey);
      expect(caughtError?.statusCode).toBe(500);
    });

    it('rejects upload with zero images or exceeding MAX_FILES (20)', async () => {
      await expect(
        uploadGroup({
          host: '127.0.0.1',
          port: 8000,
          token: 'token',
          images: [],
        })
      ).rejects.toThrow(/at least 1 image/);

      const tooManyImages = Array.from({ length: 21 }, (_, i) => ({
        uri: `file:///img_${i}.webp`,
      }));

      await expect(
        uploadGroup({
          host: '127.0.0.1',
          port: 8000,
          token: 'token',
          images: tooManyImages,
        })
      ).rejects.toThrow(/Exceeded maximum allowed files/);
    });
  });

  // =========================================================================
  // 3. Discovery Validation (Beacons, Health, Subnet)
  // =========================================================================
  describe('Discovery Validation', () => {
    it('validates a conformant UDP beacon payload', () => {
      const validPayload = {
        service: 'imgdrop',
        v: 1,
        id: 'server_12345',
        port: 8000,
        ts: Date.now(),
      };

      expect(isValidBeaconPayload(validPayload)).toBe(true);
      expect(isValidBeaconPayload(validPayload, 'server_12345')).toBe(true);
      expect(isValidBeaconPayload(validPayload, 'other_server')).toBe(false);
    });

    it('rejects invalid or malformed UDP beacon payloads', () => {
      expect(isValidBeaconPayload(null)).toBe(false);
      expect(isValidBeaconPayload({})).toBe(false);
      expect(isValidBeaconPayload({ service: 'other', v: 1, id: 's', port: 8000, ts: 100 })).toBe(false);
      expect(isValidBeaconPayload({ service: 'imgdrop', v: 0, id: 's', port: 8000, ts: 100 })).toBe(false);
      expect(isValidBeaconPayload({ service: 'imgdrop', v: 1, id: '', port: 8000, ts: 100 })).toBe(false);
      expect(isValidBeaconPayload({ service: 'imgdrop', v: 1, id: 's', port: 70000, ts: 100 })).toBe(false);
    });

    it('validates GET /health response payload', () => {
      const validHealth = {
        status: 'ok',
        server_id: 'server_abc',
        version: '1.0.0',
      };

      expect(isValidHealthResponse(validHealth)).toBe(true);
      expect(isValidHealthResponse(validHealth, 'server_abc')).toBe(true);
      expect(isValidHealthResponse(validHealth, 'different_id')).toBe(false);
      expect(isValidHealthResponse({ status: 'error', server_id: 'server_abc' })).toBe(false);
      expect(isValidHealthResponse({ status: 'ok', server_id: '' })).toBe(false);
    });

    it('extracts /24 subnet base from IPv4 strings', () => {
      expect(extractSubnetBase('192.168.43.15')).toBe('192.168.43.');
      expect(extractSubnetBase('172.20.10.2')).toBe('172.20.10.');
      expect(extractSubnetBase('192.168.137.1')).toBe('192.168.137.');
      expect(extractSubnetBase('invalid')).toBeNull();
    });
  });

  // =========================================================================
  // 4. Secure & Fallback Storage
  // =========================================================================
  describe('Pairing Credentials Storage', () => {
    it('saves and retrieves PairingCredentials', async () => {
      const creds: PairingCredentials = {
        serverId: 'srv_123456789',
        token: 'tok_abcdef123456',
        port: 8000,
        host: '192.168.43.50',
      };

      await saveCredentials(creds);
      const retrieved = await getCredentials();

      expect(retrieved).not.toBeNull();
      expect(retrieved?.serverId).toBe(creds.serverId);
      expect(retrieved?.token).toBe(creds.token);
      expect(retrieved?.port).toBe(8000);
      expect(retrieved?.host).toBe('192.168.43.50');
    });

    it('clears stored credentials', async () => {
      await saveCredentials({
        serverId: 'srv_test',
        token: 'tok_test',
        port: 8000,
      });

      expect(await getCredentials()).not.toBeNull();
      await clearCredentials();
      expect(await getCredentials()).toBeNull();
    });

    it('throws when saving credentials without required serverId or token', async () => {
      // @ts-expect-error test invalid credentials
      await expect(saveCredentials(null)).rejects.toThrow();
      // @ts-expect-error test missing token
      await expect(saveCredentials({ serverId: '123' })).rejects.toThrow();
      // @ts-expect-error test empty token
      await expect(saveCredentials({ serverId: '123', token: '' })).rejects.toThrow();
    });

    it('supports custom StorageDriver', async () => {
      const memory = new Map<string, string>();
      setStorageDriver({
        async getItem(k) {
          return memory.get(k) ?? null;
        },
        async setItem(k, v) {
          memory.set(k, v);
        },
        async deleteItem(k) {
          memory.delete(k);
        },
      });

      await saveCredentials({ serverId: 'custom_srv', token: 'custom_tok', port: 9000 });
      const retrieved = await getCredentials();
      expect(retrieved?.serverId).toBe('custom_srv');
      expect(retrieved?.port).toBe(9000);
    });
  });
});
