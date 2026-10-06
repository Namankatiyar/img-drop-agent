import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { monotonicFactory } from 'ulidx';
import type { Database } from 'bun:sqlite';
import type { Config, GroupRecord, ImageRecord, GroupStatus } from '../types.ts';
import {
  getGroupById,
  getGroupByClientKey,
  getLatestGroup,
  listGroups,
  insertGroupWithImages,
  claimGroup,
  releaseGroup,
} from '../db.ts';
import {
  sniffImageFileSync,
  atomicMoveDirectory,
  cleanupDir,
} from '../storage.ts';

const ULID_REGEX = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/i;

const getParamString = (val: string | string[] | undefined): string =>
  Array.isArray(val) ? val[0] : val ?? '';

export function isValidUlid(id: string): boolean {
  return typeof id === 'string' && ULID_REGEX.test(id);
}

interface CustomRequest extends Request {
  _groupId?: string;
  _groupTmpDir?: string;
}

export function createGroupsRouter(db: Database, cfg: Config): Router {
  const router = Router();
  const generateUlid = monotonicFactory();

  // Configure Multer storage
  const storage = multer.diskStorage({
    destination: (req: CustomRequest, _file, cb) => {
      try {
        if (!req._groupId) {
          req._groupId = generateUlid();
          req._groupTmpDir = path.join(cfg.tmpDir, req._groupId);
          fs.mkdirSync(req._groupTmpDir, { recursive: true });
        }
        cb(null, req._groupTmpDir!);
      } catch (err: any) {
        cb(err, '');
      }
    },
    filename: (_req, _file, cb) => {
      // Temporary random filename during upload
      cb(null, crypto.randomUUID());
    },
  });

  const upload = multer({
    storage,
    limits: {
      fileSize: cfg.maxFileMb * 1024 * 1024,
      files: cfg.maxFiles,
      fieldSize: 50 * 1024,
    },
  });

  // GET /groups/latest (MUST be defined before /groups/:id)
  router.get('/latest', (req: Request, res: Response) => {
    const unclaimedOnly = req.query.unclaimed === '1' || req.query.unclaimed === 'true';
    const group = getLatestGroup(db, unclaimedOnly);

    if (!group) {
      res.status(204).end();
      return;
    }

    res.status(200).json(group);
  });

  // GET /groups
  router.get('/', (req: Request, res: Response) => {
    let status: GroupStatus | undefined;
    if (req.query.status !== undefined) {
      const qStatus = String(req.query.status).toLowerCase();
      if (qStatus !== 'ready' && qStatus !== 'claimed') {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid status parameter. Must be "ready" or "claimed".',
          },
        });
        return;
      }
      status = qStatus as GroupStatus;
    }

    let limit = 20;
    if (req.query.limit !== undefined) {
      const parsedLimit = Number(req.query.limit);
      if (isNaN(parsedLimit) || parsedLimit <= 0) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid limit parameter. Must be a positive integer.',
          },
        });
        return;
      }
      limit = parsedLimit;
    }

    const groups = listGroups(db, status, limit);
    res.status(200).json({ groups });
  });

  // POST /groups
  router.post(
    '/',
    // 1. Idempotency Check Middleware before parsing multipart
    (req: CustomRequest, res: Response, next: NextFunction) => {
      const idempotencyKey = getParamString(req.headers['idempotency-key']);
      if (idempotencyKey.trim().length > 0) {
        const trimmed = idempotencyKey.trim();
        const existing = getGroupByClientKey(db, trimmed);
        if (existing) {
          res.status(200).json(existing);
          return;
        }
      }
      next();
    },
    // 2. Multer upload handler with error translation
    (req: CustomRequest, res: Response, next: NextFunction) => {
      upload.array('images', cfg.maxFiles)(req, res, (err: any) => {
        if (err) {
          if (req._groupTmpDir) {
            cleanupDir(req._groupTmpDir);
          }
          if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
              res.status(413).json({
                error: {
                  code: 'PAYLOAD_TOO_LARGE',
                  message: `Individual file exceeds maximum allowed size of ${cfg.maxFileMb}MB`,
                },
              });
              return;
            }
            if (err.code === 'LIMIT_FILE_COUNT') {
              res.status(413).json({
                error: {
                  code: 'LIMIT_FILE_COUNT',
                  message: `File count exceeds maximum allowed limit of ${cfg.maxFiles}`,
                },
              });
              return;
            }
            res.status(400).json({
              error: {
                code: 'BAD_REQUEST',
                message: err.message,
              },
            });
            return;
          }
          next(err);
          return;
        }
        next();
      });
    },
    // 3. Process uploaded files & validate
    (req: CustomRequest, res: Response) => {
      const files = req.files as Express.Multer.File[] | undefined;
      const tmpDir = req._groupTmpDir;

      if (!files || files.length === 0) {
        if (tmpDir) cleanupDir(tmpDir);
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'At least one image file is required in field "images".',
          },
        });
        return;
      }

      // Check total size limit (MAX_REQUEST_MB)
      const maxTotalBytes = cfg.maxRequestMb * 1024 * 1024;
      const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
      if (totalBytes > maxTotalBytes) {
        if (tmpDir) cleanupDir(tmpDir);
        res.status(413).json({
          error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: `Total upload size (${Math.round(totalBytes / 1024 / 1024)}MB) exceeds maximum limit of ${cfg.maxRequestMb}MB`,
          },
        });
        return;
      }

      // Validate note if present
      let note: string | null = null;
      if (req.body.note !== undefined && req.body.note !== null) {
        const rawNote = String(req.body.note);
        if (rawNote.length > 2000) {
          if (tmpDir) cleanupDir(tmpDir);
          res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Note must not exceed 2000 characters.',
            },
          });
          return;
        }
        note = rawNote;
      }

      const groupId = req._groupId || generateUlid();
      const rawClientKey = getParamString(req.headers['idempotency-key']).trim();
      const clientKey = rawClientKey.length > 0 ? rawClientKey : null;

      // Validate magic bytes for all images
      const validatedFiles: Array<{
        file: Express.Multer.File;
        mime: string;
        ext: string;
      }> = [];

      for (const file of files) {
        const typeInfo = sniffImageFileSync(file.path);
        if (!typeInfo) {
          if (tmpDir) cleanupDir(tmpDir);
          res.status(415).json({
            error: {
              code: 'UNSUPPORTED_MEDIA_TYPE',
              message: 'Invalid or unsupported image format. Allowed formats: webp, jpeg, png.',
            },
          });
          return;
        }
        validatedFiles.push({
          file,
          mime: typeInfo.mime,
          ext: typeInfo.ext,
        });
      }

      // Rename files sequentially: 01.<ext>, 02.<ext>, ...
      const images: ImageRecord[] = [];
      try {
        for (let i = 0; i < validatedFiles.length; i++) {
          const position = i + 1;
          const { file, mime, ext } = validatedFiles[i];
          const fileName = `${String(position).padStart(2, '0')}.${ext}`;
          const destPath = path.join(tmpDir!, fileName);

          try {
            fs.renameSync(file.path, destPath);
          } catch {
            fs.copyFileSync(file.path, destPath);
            fs.unlinkSync(file.path);
          }

          images.push({
            id: generateUlid(),
            group_id: groupId,
            position,
            file_name: fileName,
            mime,
            size_bytes: file.size,
          });
        }

        // Atomically move directory from tmp to storage
        const targetDir = path.join(cfg.storageDir, groupId);
        atomicMoveDirectory(tmpDir!, targetDir);

        // Insert into SQLite transaction
        const now = new Date().toISOString();
        const groupRecord: GroupRecord = {
          id: groupId,
          created_at: now,
          status: 'ready',
          claimed_at: null,
          note,
          client_key: clientKey,
          image_count: images.length,
        };

        insertGroupWithImages(db, groupRecord, images);

        res.status(201).json({
          ...groupRecord,
          images,
        });
      } catch (err: any) {
        if (tmpDir) cleanupDir(tmpDir);
        cleanupDir(path.join(cfg.storageDir, groupId));

        // If a concurrent request with the same client_key succeeded right before us:
        if (clientKey) {
          const existing = getGroupByClientKey(db, clientKey);
          if (existing) {
            res.status(200).json(existing);
            return;
          }
        }

        throw err;
      }
    }
  );

  // GET /groups/:id
  router.get('/:id', (req: Request, res: Response) => {
    const id = getParamString(req.params.id);
    if (!isValidUlid(id)) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid group ID format.',
        },
      });
      return;
    }

    const group = getGroupById(db, id);
    if (!group) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Group not found.',
        },
      });
      return;
    }

    res.status(200).json(group);
  });

  // GET /groups/:id/images/:position
  router.get('/:id/images/:position', (req: Request, res: Response) => {
    const id = getParamString(req.params.id);
    if (!isValidUlid(id)) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid group ID format.',
        },
      });
      return;
    }

    const posStr = getParamString(req.params.position);
    const position = Number(posStr);
    if (isNaN(position) || position < 1 || !Number.isInteger(position)) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid position parameter. Must be an integer >= 1.',
        },
      });
      return;
    }

    const group = getGroupById(db, id);
    if (!group) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Group not found.',
        },
      });
      return;
    }

    const image = group.images.find((img) => img.position === position);
    if (!image) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Image at position ${position} not found in group.`,
        },
      });
      return;
    }

    const filePath = path.join(cfg.storageDir, id, image.file_name);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Image file not found on disk.',
        },
      });
      return;
    }

    res.setHeader('Content-Type', image.mime);
    res.setHeader('Content-Length', image.size_bytes.toString());
    res.sendFile(path.resolve(filePath));
  });

  // POST /groups/:id/claim
  router.post('/:id/claim', (req: Request, res: Response) => {
    const id = getParamString(req.params.id);
    if (!isValidUlid(id)) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid group ID format.',
        },
      });
      return;
    }

    const result = claimGroup(db, id);
    if (result.status === 'not_found') {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Group not found.',
        },
      });
      return;
    }

    if (result.status === 'already_claimed') {
      res.status(409).json({
        error: {
          code: 'CONFLICT',
          message: 'Group is already claimed.',
        },
      });
      return;
    }

    res.status(200).json(result.group);
  });

  // POST /groups/:id/release
  router.post('/:id/release', (req: Request, res: Response) => {
    const id = getParamString(req.params.id);
    if (!isValidUlid(id)) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid group ID format.',
        },
      });
      return;
    }

    const result = releaseGroup(db, id);
    if (result.status === 'not_found') {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Group not found.',
        },
      });
      return;
    }

    res.status(200).json(result.group);
  });

  return router;
}
