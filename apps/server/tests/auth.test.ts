import { describe, it, expect } from 'bun:test';
import { verifyToken, createAuthMiddleware } from '../src/auth.ts';

describe('Auth Module', () => {
  const secretToken = 'a'.repeat(64);

  describe('verifyToken', () => {
    it('returns true for exact matching tokens', () => {
      expect(verifyToken(secretToken, secretToken)).toBe(true);
    });

    it('returns false for tokens of different lengths', () => {
      expect(verifyToken('short', secretToken)).toBe(false);
      expect(verifyToken(secretToken + 'x', secretToken)).toBe(false);
    });

    it('returns false for mismatched tokens of identical length', () => {
      const wrongToken = 'a'.repeat(63) + 'b';
      expect(verifyToken(wrongToken, secretToken)).toBe(false);
    });

    it('returns false for empty or missing inputs', () => {
      expect(verifyToken('', secretToken)).toBe(false);
      expect(verifyToken(secretToken, '')).toBe(false);
    });
  });

  describe('createAuthMiddleware', () => {
    const middleware = createAuthMiddleware(secretToken);

    it('returns 401 when Authorization header is missing', () => {
      let statusCode = 0;
      let jsonBody: any = null;
      let nextCalled = false;

      const req: any = { headers: {} };
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (body: any) => {
              jsonBody = body;
            },
          };
        },
      };
      const next = () => {
        nextCalled = true;
      };

      middleware(req, res, next);
      expect(statusCode).toBe(401);
      expect(jsonBody.error.code).toBe('UNAUTHORIZED');
      expect(nextCalled).toBe(false);
    });

    it('returns 401 when Authorization header is not Bearer scheme', () => {
      let statusCode = 0;
      let jsonBody: any = null;

      const req: any = { headers: { authorization: `Basic ${secretToken}` } };
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (body: any) => {
              jsonBody = body;
            },
          };
        },
      };

      middleware(req, res, () => {});
      expect(statusCode).toBe(401);
      expect(jsonBody.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 when Bearer token is invalid', () => {
      let statusCode = 0;
      let jsonBody: any = null;

      const req: any = { headers: { authorization: 'Bearer wrong-token' } };
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (body: any) => {
              jsonBody = body;
            },
          };
        },
      };

      middleware(req, res, () => {});
      expect(statusCode).toBe(401);
      expect(jsonBody.error.code).toBe('UNAUTHORIZED');
    });

    it('calls next() when Bearer token is valid', () => {
      let nextCalled = false;
      const req: any = { headers: { authorization: `Bearer ${secretToken}` } };
      const res: any = {};

      middleware(req, res, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
    });
  });
});
