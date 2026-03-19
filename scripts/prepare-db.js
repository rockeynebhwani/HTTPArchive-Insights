#!/usr/bin/env node
/**
 * prepare-db.js
 * Converts insights.db from WAL journal mode to DELETE mode.
 * Required before deploying to Vercel (read-only filesystem can't write WAL files).
 *
 * Usage: node scripts/prepare-db.js [path/to/insights.db]
 */

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const dbPath = process.argv[2] || path.join(__dirname, "../data/insights.db");

if (!fs.existsSync(dbPath)) {
  console.log(`No DB found at ${dbPath} — skipping WAL conversion.`);
  process.exit(0);
}

console.log(`Converting ${dbPath} to DELETE journal mode...`);

// Use sqlite3 CLI if available, otherwise use a node approach
try {
  execSync(`sqlite3 "${dbPath}" "PRAGMA journal_mode=DELETE; PRAGMA wal_checkpoint(TRUNCATE);"`, {
    stdio: "inherit",
  });
  console.log("Done.");
} catch (e) {
  console.error("sqlite3 CLI not found. Install it or run manually:");
  console.error(`  sqlite3 "${dbPath}" "PRAGMA journal_mode=DELETE;"`);
  process.exit(1);
}
