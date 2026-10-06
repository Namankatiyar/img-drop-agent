import path from 'node:path';
import { config } from './config.ts';
import { initDatabase, pruneClaimedGroups } from './db.ts';
import { cleanupDir } from './storage.ts';

function parseDaysArg(): number {
  const args = process.argv.slice(2);
  let days = 30; // default 30 days

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--days=')) {
      const parsed = Number(arg.split('=')[1]);
      if (!isNaN(parsed) && parsed >= 0) {
        days = parsed;
      }
    } else if (arg === '-d' || arg === '--days') {
      const next = Number(args[i + 1]);
      if (!isNaN(next) && next >= 0) {
        days = next;
        i++;
      }
    }
  }

  return days;
}

async function runPrune() {
  const days = parseDaysArg();
  console.log(`[Prune] Pruning claimed groups older than ${days} day(s)...`);

  const db = initDatabase(config.dbFile);
  try {
    const deletedIds = pruneClaimedGroups(db, days);
    console.log(`[Prune] Database rows deleted: ${deletedIds.length}`);

    let directoriesRemoved = 0;
    for (const id of deletedIds) {
      const dirPath = path.join(config.storageDir, id);
      cleanupDir(dirPath);
      directoriesRemoved++;
    }

    console.log(`[Prune] Storage directories removed: ${directoriesRemoved}`);
    console.log(`[Prune] Successfully completed pruning.`);
  } finally {
    db.close();
  }
}

runPrune().catch((err) => {
  console.error('[Prune] Error during prune execution:', err);
  process.exit(1);
});
