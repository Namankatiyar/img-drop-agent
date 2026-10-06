import path from 'node:path';
import {
  DEFAULT_PORT,
  BEACON_PORT,
  BEACON_INTERVAL_MS,
  MAX_FILES,
  MAX_FILE_MB,
  MAX_REQUEST_MB,
} from '@imgdrop/shared';
import type { Config } from './types.ts';

export function getConfig(overrides?: Partial<Config>): Config {
  const dataDir = overrides?.dataDir ?? process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');
  const port = overrides?.port ?? Number(process.env.PORT || DEFAULT_PORT);
  const beaconPort = overrides?.beaconPort ?? Number(process.env.BEACON_PORT || BEACON_PORT);
  const beaconIntervalMs = overrides?.beaconIntervalMs ?? Number(process.env.BEACON_INTERVAL_MS || BEACON_INTERVAL_MS);
  const maxFiles = overrides?.maxFiles ?? Number(process.env.MAX_FILES || MAX_FILES);
  const maxFileMb = overrides?.maxFileMb ?? Number(process.env.MAX_FILE_MB || MAX_FILE_MB);
  const maxRequestMb = overrides?.maxRequestMb ?? Number(process.env.MAX_REQUEST_MB || MAX_REQUEST_MB);

  const storageDir = overrides?.storageDir ?? path.join(dataDir, 'storage');
  const tmpDir = overrides?.tmpDir ?? path.join(storageDir, '.tmp');
  const configFile = overrides?.configFile ?? path.join(dataDir, 'config.json');
  const dbFile = overrides?.dbFile ?? path.join(dataDir, 'app.db');

  return {
    port,
    dataDir,
    storageDir,
    tmpDir,
    configFile,
    dbFile,
    beaconPort,
    beaconIntervalMs,
    maxFiles,
    maxFileMb,
    maxRequestMb,
  };
}

export const config = getConfig();
