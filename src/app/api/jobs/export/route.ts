import { NextResponse } from "next/server";
import Papa from "papaparse";
import { PassThrough } from "node:stream";
import { getJobsIterator } from "@/actions/job.actions";
import { format } from "date-fns";

const FIELDS: string[] = [
  "index",
  "createdAt",
  "applied",
  "appliedDate",
  "Company",
  "JobTitle",
  "jobType",
  "Locations",
  "JobSource",
  "Status",
];

interface JobExportRow {
  index: number;
  createdAt: string;
  applied: string;
  appliedDate: string;
  Company: string;
  JobTitle: string;
  jobType: string;
  Locations: string;
  JobSource: string;
  Status: string;
}

interface LabeledField {
  label?: string;
}

interface JobRecord {
  createdAt?: Date | string;
  applied?: boolean;
  appliedDate?: Date | string;
  Company?: LabeledField;
  JobTitle?: LabeledField;
  jobType?: string;
  Locations?: { label: string }[];
  JobSource?: LabeledField;
  Status?: LabeledField;
}

const extractLabel = (field: LabeledField | undefined): string => {
  return field?.label || "N/A";
};

const mapJobType = (type: string | undefined): string => {
  switch (type) {
    case "FT":
      return "Full Time";
    case "PT":
      return "Part Time";
    case "C":
      return "Contract";
    default:
      return "Unknown";
  }
};

const transformJobData = (
  job: JobRecord,
  index: number
): JobExportRow => {
  return {
    index: index + 1,
    createdAt: job.createdAt
      ? format(new Date(job.createdAt), "yyyy-MM-dd")
      : "N/A",
    applied: job.applied ? "Yes" : "No",
    appliedDate: job.appliedDate
      ? format(new Date(job.appliedDate), "yyyy-MM-dd")
      : "N/A",
    Company: extractLabel(job.Company),
    JobTitle: extractLabel(job.JobTitle),
    jobType: mapJobType(job.jobType),
    Locations: job.Locations?.map((l: { label: string }) => l.label).join(", ") || "N/A",
    JobSource: extractLabel(job.JobSource),
    Status: extractLabel(job.Status),
  };
};

export const POST = async () => {
  const passThrough = new PassThrough();
  let isFirstChunk = true;
  let hasError = false;

  (async () => {
    try {
      let recordIndex = 0;
      for await (const chunk of getJobsIterator()) {
        if (hasError) break;
        const transformedData = chunk.map((job, idx) =>
          transformJobData(job, recordIndex + idx)
        );
        recordIndex += chunk.length;
        const csv = Papa.unparse(
          { fields: FIELDS, data: transformedData },
          {
            header: isFirstChunk,
          }
        );
        passThrough.write((isFirstChunk ? "" : "\n") + csv);
        isFirstChunk = false;
      }
    } catch (error) {
      hasError = true;
      console.error("Error streaming CSV:", error);
      if (error instanceof Error) {
        return NextResponse.json(
          {
            error: error.message ?? "Jobs download failed",
          },
          {
            status: 500,
          }
        );
      }
    } finally {
      passThrough.end();
    }
  })();

  return new NextResponse(passThrough as any, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="jobs.csv"',
    },
  });
};
