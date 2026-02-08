import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "../env.js";
import { createPool } from "./conn.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const pool = createPool();
  if (!pool) {
    // In some demo/spectate-only deployments we intentionally run without Postgres.
    // Allow skipping migrations in that mode so the API can still boot.
    const requireDb = process.env.REQUIRE_DB !== "0";
    const skip = process.env.SKIP_MIGRATIONS === "1" || !requireDb;
    if (skip) {
      console.warn("DATABASE_URL is not set; skipping migrations");
      return;
    }
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const migrationsDir = path.resolve(__dirname, "../../migrations");
  const files = (await fs.readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  await pool.query(
    "create table if not exists _migrations (id text primary key, applied_at timestamptz not null default now());",
  );

  for (const file of files) {
    const id = file;
    const applied = await pool.query("select 1 from _migrations where id = $1", [
      id,
    ]);
    if (applied.rowCount && applied.rowCount > 0) continue;

    const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
    await pool.query("begin");
    try {
      await pool.query(sql);
      await pool.query("insert into _migrations (id) values ($1)", [id]);
      await pool.query("commit");
      console.log(`applied ${id}`);
    } catch (err) {
      await pool.query("rollback");
      throw err;
    }
  }

  await pool.end();
}

await main();
