import { Router } from 'express';
import type { Request, Response } from 'express';
import type { HealthResponse } from '@imgdrop/shared';

export function createHealthRouter(serverIdOrGetter: string | (() => string)): Router {
  const router = Router();

  router.get('/', (_req: Request, res: Response) => {
    const server_id = typeof serverIdOrGetter === 'function' ? serverIdOrGetter() : serverIdOrGetter;
    const response: HealthResponse = {
      status: 'ok',
      server_id,
      version: '1.0.0',
    };
    res.status(200).json(response);
  });

  return router;
}
