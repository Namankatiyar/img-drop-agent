import crypto from 'node:crypto';
import type { Request, Response, NextFunction, RequestHandler } from 'express';

export function verifyToken(providedToken: string, expectedToken: string): boolean {
  if (!providedToken || !expectedToken) {
    return false;
  }
  const providedBuf = Buffer.from(providedToken, 'utf-8');
  const expectedBuf = Buffer.from(expectedToken, 'utf-8');

  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

export function createAuthMiddleware(tokenOrGetter: string | (() => string)): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || typeof authHeader !== 'string') {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or missing bearer token',
        },
      });
      return;
    }

    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or missing bearer token',
        },
      });
      return;
    }

    const providedToken = match[1].trim();
    const expectedToken = typeof tokenOrGetter === 'function' ? tokenOrGetter() : tokenOrGetter;

    if (!verifyToken(providedToken, expectedToken)) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or missing bearer token',
        },
      });
      return;
    }

    next();
  };
}
