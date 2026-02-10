-- CreateTable
CREATE TABLE "PipelineRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT,
    "resumeId" TEXT,
    "sourceUrl" TEXT,
    "rawContent" TEXT NOT NULL,
    "cleanedContent" TEXT NOT NULL,
    "extractedData" TEXT,
    "configHash" TEXT NOT NULL,
    "pipelineConfig" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PipelineRun_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PipelineRun_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PipelineRun_jobId_idx" ON "PipelineRun"("jobId");

-- CreateIndex
CREATE INDEX "PipelineRun_resumeId_idx" ON "PipelineRun"("resumeId");

-- CreateIndex
CREATE INDEX "PipelineRun_configHash_idx" ON "PipelineRun"("configHash");
