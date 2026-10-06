import http from 'node:http';
import { config } from './config.ts';
import { ensureStorageDirs, sweepOrphans } from './storage.ts';
import { loadOrInitCredentials, displayPairingInfo } from './pair.ts';
import { initDatabase } from './db.ts';
import { createApp } from './app.ts';
import { createBeaconService } from './beacon.ts';

async function main() {
  console.log('[ImgDrop] Starting backend service...');

  // 1. Ensure storage directories exist
  ensureStorageDirs(config);

  // 2. Load or generate credentials
  const credentials = loadOrInitCredentials(config.configFile);

  // 3. Initialize Database
  const db = initDatabase(config.dbFile);

  // 4. Run startup orphan sweep
  const sweepStats = sweepOrphans(config, db);
  if (sweepStats.removedTmpCount > 0 || sweepStats.removedOrphanDirCount > 0) {
    console.log(
      `[ImgDrop] Orphan sweep complete: cleaned ${sweepStats.removedTmpCount} tmp items, ${sweepStats.removedOrphanDirCount} unindexed directories.`
    );
  }

  // 5. Create Express App
  const app = createApp({ db, config, credentials });

  // 6. Create HTTP Server & Beacon
  const server = http.createServer(app);
  const beacon = createBeaconService(config, credentials);

  // 7. Register Graceful Shutdown
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[ImgDrop] Received ${signal}. Shutting down gracefully...`);

    try {
      await beacon.stop();
      console.log('[ImgDrop] UDP Beacon stopped.');
    } catch (err) {
      console.error('[ImgDrop] Error stopping beacon:', err);
    }

    server.close(() => {
      console.log('[ImgDrop] HTTP server closed.');
      try {
        db.close();
        console.log('[ImgDrop] SQLite database closed.');
      } catch (err) {
        console.error('[ImgDrop] Error closing SQLite database:', err);
      }
      process.exit(0);
    });

    // Force exit if hanging
    setTimeout(() => {
      console.warn('[ImgDrop] Forced shutdown after timeout.');
      process.exit(1);
    }, 5000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // 8. Start HTTP Server
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, '0.0.0.0', () => {
      server.removeListener('error', reject);
      resolve();
    });
  });

  console.log(`[ImgDrop] HTTP server listening on port ${config.port}`);

  // 9. Start UDP Beacon
  beacon.start();
  console.log(`[ImgDrop] UDP Discovery Beacon active on port ${config.beaconPort}`);

  // 10. Display Pairing Information
  displayPairingInfo(credentials, config.port);
}

main().catch((err) => {
  console.error('[ImgDrop] Fatal error during startup:', err);
  process.exit(1);
});
