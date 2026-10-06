import express from 'express';
import type { Express, Request, Response, NextFunction } from 'express';
import type { Database } from 'bun:sqlite';
import type { Config, AuthCredentials } from './types.ts';
import { createAuthMiddleware } from './auth.ts';
import { createHealthRouter } from './routes/health.ts';
import { createGroupsRouter } from './routes/groups.ts';

export interface AppOptions {
  db: Database;
  config: Config;
  credentials: AuthCredentials;
}

export function createApp(options: AppOptions): Express {
  const { db, config, credentials } = options;
  const app = express();

  // Basic middleware
  app.use(express.json());

  // 1. Unauthenticated routes: GET /health
  app.use('/health', createHealthRouter(() => credentials.server_id));

  // 2. Authentication middleware
  app.use(createAuthMiddleware(() => credentials.token));

  // 3. Authenticated routes: /groups
  app.use('/groups', createGroupsRouter(db, config));

  // 4. 404 Handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found',
      },
    });
  });

  // 5. Global Error Handler (4-arity)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = typeof err.status === 'number' ? err.status : typeof err.statusCode === 'number' ? err.statusCode : 500;
    const defaultCode =
      status === 400
        ? 'BAD_REQUEST'
        : status === 401
        ? 'UNAUTHORIZED'
        : status === 404
        ? 'NOT_FOUND'
        : status === 409
        ? 'CONFLICT'
        : status === 413
        ? 'PAYLOAD_TOO_LARGE'
        : status === 415
        ? 'UNSUPPORTED_MEDIA_TYPE'
        : 'INTERNAL_SERVER_ERROR';
    const code = err.code && typeof err.code === 'string' ? err.code : defaultCode;
    const message = err.message || 'An unexpected error occurred';

    if (status >= 500) {
      console.error('[Error Handler]', err);
    }

    res.status(status).json({
      error: {
        code,
        message,
      },
    });
  });

  return app;
}
