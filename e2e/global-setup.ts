import { execSync } from "child_process";
import path from "path";

export default function globalSetup() {
  const testDbPath = path.resolve(__dirname, "..", "prisma", "test-e2e.db");
  const projectRoot = path.resolve(__dirname, "..");

  // Clear all data from the test database without deleting the file.
  // The webServer is already running at this point (Playwright starts it
  // before globalSetup), so we must preserve the file inode to avoid
  // SQLITE_READONLY_DBMOVED on the server's open SQLite connection.
  console.log("Clearing test database data...");
  const tables = execSync(
    `sqlite3 "${testDbPath}" "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%';"`,
    { encoding: "utf-8" }
  )
    .trim()
    .split("\n")
    .filter(Boolean);

  if (tables.length > 0) {
    const deleteStatements = tables
      .map((t) => `DELETE FROM "${t}";`)
      .join(" ");
    execSync(
      `sqlite3 "${testDbPath}" "PRAGMA foreign_keys=OFF; ${deleteStatements} PRAGMA foreign_keys=ON;"`,
      { stdio: "inherit" }
    );
  }

  // Seed test database with fresh data
  console.log("Seeding test database...");
  execSync("npm run seed", {
    stdio: "inherit",
    cwd: projectRoot,
  });

  console.log("Test database ready.");
}
