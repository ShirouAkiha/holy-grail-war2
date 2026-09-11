const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

function createBackup() {
  ensureDirs();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const snapshotFolder = path.join(BACKUPS_DIR, `snapshot_${timestamp}`);
  fs.mkdirSync(snapshotFolder, { recursive: true });

  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
  let copied = 0;

  for (const file of files) {
    const src = path.join(DATA_DIR, file);
    const dest = path.join(snapshotFolder, file);
    const latestDest = path.join(BACKUPS_DIR, `${file.replace('.json', '')}.latest.json`);
    
    fs.copyFileSync(src, dest);
    fs.copyFileSync(src, latestDest);
    copied++;
  }

  console.log(`\n========================================`);
  console.log(`[Backup Manager] Successfully backed up ${copied} database files!`);
  console.log(`Destination Snapshot: ${snapshotFolder}`);
  console.log(`Latest mirrors updated in: ${BACKUPS_DIR}`);
  console.log(`========================================\n`);
}

function restoreBackup() {
  ensureDirs();
  const snapshots = fs.readdirSync(BACKUPS_DIR)
    .filter(f => f.startsWith('snapshot_') && fs.statSync(path.join(BACKUPS_DIR, f)).isDirectory())
    .sort()
    .reverse();

  if (snapshots.length === 0) {
    // Try latest.json files
    const latestFiles = fs.readdirSync(BACKUPS_DIR).filter(f => f.endsWith('.latest.json'));
    if (latestFiles.length === 0) {
      console.log('[Backup Manager] No snapshots or backup files found in data/backups.');
      return;
    }
    for (const lf of latestFiles) {
      const origName = lf.replace('.latest.json', '.json');
      fs.copyFileSync(path.join(BACKUPS_DIR, lf), path.join(DATA_DIR, origName));
      console.log(`Restored ${origName} from latest backup.`);
    }
    console.log('[Backup Manager] Successfully restored latest mirrors.');
    return;
  }

  const latestSnapshot = snapshots[0];
  const snapshotPath = path.join(BACKUPS_DIR, latestSnapshot);
  const files = fs.readdirSync(snapshotPath).filter(f => f.endsWith('.json'));

  console.log(`[Backup Manager] Restoring from latest snapshot: ${latestSnapshot}...`);
  for (const file of files) {
    fs.copyFileSync(path.join(snapshotPath, file), path.join(DATA_DIR, file));
    console.log(` -> Restored data/${file}`);
  }
  console.log(`[Backup Manager] Full restore complete!\n`);
}

function gitProtect() {
  console.log(`\n================================================================`);
  console.log(`[Git Protection] Stop Git from overwriting your game data:`);
  console.log(`================================================================`);
  console.log(`1. Run this command to tell Git to stop tracking data files`);
  console.log(`   (without deleting your actual local files):`);
  console.log(``);
  console.log(`   git rm --cached data/*.json`);
  console.log(`   git add .gitignore`);
  console.log(`   git commit -m "chore: ignore runtime data files to prevent git pull resets"`);
  console.log(``);
  console.log(`2. If you are pulling updates from a remote repository that already has data/*.json committed:`);
  console.log(``);
  console.log(`   git update-index --assume-unchanged data/*.json`);
  console.log(`   # or`);
  console.log(`   git update-index --skip-worktree data/masters.json data/grail_war.json`);
  console.log(`================================================================\n`);
}

const action = process.argv[2] || 'backup';
if (action === 'backup') {
  createBackup();
} else if (action === 'restore') {
  restoreBackup();
} else if (action === 'git-protect' || action === 'protect') {
  gitProtect();
} else {
  console.log(`Unknown command "${action}". Use "backup", "restore", or "git-protect".`);
}
