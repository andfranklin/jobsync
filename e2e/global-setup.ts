import { execSync } from "child_process";
import fs from "fs";
import path from "path";

export default function globalSetup() {
  const testDbPath = path.resolve(__dirname, "..", "prisma", "test-e2e.db");
  const testDbJournalPath = testDbPath + "-journal";
  const projectRoot = path.resolve(__dirname, "..");

  // Remove existing test database for a clean start
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  if (fs.existsSync(testDbJournalPath)) {
    fs.unlinkSync(testDbJournalPath);
  }

  // Create test database schema
  console.log("Creating test database schema...");
  execSync("npx prisma db push --skip-generate", {
    stdio: "inherit",
    cwd: projectRoot,
  });

  // Seed test database
  console.log("Seeding test database...");
  execSync("npm run seed", {
    stdio: "inherit",
    cwd: projectRoot,
  });

  console.log("Test database ready.");
}
