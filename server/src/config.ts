import path from 'node:path';
import type { Config } from './types.ts';

export function getConfig(overrides?: Partial<Config>): Config {
  const dataDir = overrides?.dataDir ?? process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');
  const port = overrides?.port ?? Number(process.env.PORT || 8000);
  const beaconPort = overrides?.beaconPort ?? Number(process.env.BEACON_PORT || 41716);
  const beaconIntervalMs = overrides?.beaconIntervalMs ?? Number(process.env.BEACON_INTERVAL_MS || 3000);
  const maxFiles = overrides?.maxFiles ?? Number(process.env.MAX_FILES || 20);
  const maxFileMb = overrides?.maxFileMb ?? Number(process.env.MAX_FILE_MB || 8);
  const maxRequestMb = overrides?.maxRequestMb ?? Number(process.env.MAX_REQUEST_MB || 50);

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
