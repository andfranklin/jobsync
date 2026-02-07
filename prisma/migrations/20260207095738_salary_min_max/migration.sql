/*
  Warnings:

  - You are about to drop the column `salaryRange` on the `Job` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "jobUrl" TEXT,
    "description" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "appliedDate" DATETIME,
    "dueDate" DATETIME,
    "statusId" TEXT NOT NULL,
    "jobTitleId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobSourceId" TEXT,
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "resumeId" TEXT,
    CONSTRAINT "Job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Job_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "JobStatus" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Job_jobTitleId_fkey" FOREIGN KEY ("jobTitleId") REFERENCES "JobTitle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Job_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Job_jobSourceId_fkey" FOREIGN KEY ("jobSourceId") REFERENCES "JobSource" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Job_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Job" ("applied", "appliedDate", "companyId", "createdAt", "description", "dueDate", "id", "jobSourceId", "jobTitleId", "jobType", "jobUrl", "resumeId", "statusId", "userId", "salaryMin", "salaryMax")
SELECT "applied", "appliedDate", "companyId", "createdAt", "description", "dueDate", "id", "jobSourceId", "jobTitleId", "jobType", "jobUrl", "resumeId", "statusId", "userId",
  CASE
    WHEN "salaryRange" = '6' THEN 50000
    WHEN "salaryRange" = '7' THEN 60000
    WHEN "salaryRange" = '8' THEN 70000
    WHEN "salaryRange" = '9' THEN 80000
    WHEN "salaryRange" = '10' THEN 90000
    WHEN "salaryRange" = '11' THEN 100000
    WHEN "salaryRange" = '12' THEN 120000
    WHEN "salaryRange" = '13' THEN 130000
    WHEN "salaryRange" = '14' THEN 150000
    ELSE NULL
  END,
  CASE
    WHEN "salaryRange" = '6' THEN 60000
    WHEN "salaryRange" = '7' THEN 70000
    WHEN "salaryRange" = '8' THEN 80000
    WHEN "salaryRange" = '9' THEN 90000
    WHEN "salaryRange" = '10' THEN 100000
    WHEN "salaryRange" = '11' THEN 110000
    WHEN "salaryRange" = '12' THEN 130000
    WHEN "salaryRange" = '13' THEN 140000
    ELSE NULL
  END
FROM "Job";
DROP TABLE "Job";
ALTER TABLE "new_Job" RENAME TO "Job";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
