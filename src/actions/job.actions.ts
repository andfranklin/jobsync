"use server";
import prisma from "@/lib/db";
import { handleError } from "@/lib/utils";
import { AddJobFormSchema } from "@/models/addJobForm.schema";
import { JOB_TYPES, JobStatus } from "@/models/job.model";
import { requireUser } from "@/utils/user.utils";
import { APP_CONSTANTS } from "@/lib/constants";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { hashPipelineConfig } from "@/lib/ai/pipeline";
import type { PipelineConfig } from "@/models/pipeline.model";
import type { AiProvider } from "@/models/ai.model";
import { getTextLimit } from "@/lib/ai/config";

export const getStatusList = async (): Promise<any | undefined> => {
  try {
    const statuses = await prisma.jobStatus.findMany();
    return statuses;
  } catch (error) {
    const msg = "Failed to fetch status list. ";
    return handleError(error, msg);
  }
};

export const getJobSourceList = async (): Promise<any | undefined> => {
  try {
    const list = await prisma.jobSource.findMany();
    return list;
  } catch (error) {
    const msg = "Failed to fetch job source list. ";
    return handleError(error, msg);
  }
};

export const createJobSource = async (
  label: string,
  value: string,
): Promise<{ id: string; label: string; value: string } | undefined> => {
  try {
    const source = await prisma.jobSource.upsert({
      where: { value },
      update: { label },
      create: { label, value },
    });
    return source;
  } catch (error) {
    return handleError(error, "Failed to create job source. ");
  }
};

export const getJobsList = async (
  page: number = 1,
  limit: number = APP_CONSTANTS.RECORDS_PER_PAGE,
  filter?: string,
  search?: string
): Promise<any | undefined> => {
  try {
    const user = await requireUser();
    const skip = (page - 1) * limit;

    const filterBy = filter
      ? filter === Object.keys(JOB_TYPES)[1]
        ? {
            jobType: filter,
          }
        : {
            Status: {
              value: filter,
            },
          }
      : {};

    const whereClause: Prisma.JobWhereInput = {
      userId: user.id,
      ...filterBy,
    };

    if (search) {
      whereClause.OR = [
        { JobTitle: { label: { contains: search } } },
        { Company: { label: { contains: search } } },
        { Locations: { some: { label: { contains: search } } } },
        { description: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.job.findMany({
        where: whereClause,
        skip,
        take: limit,
        select: {
          id: true,
          JobSource: true,
          JobTitle: true,
          jobType: true,
          workArrangement: true,
          Company: true,
          Status: true,
          Locations: true,
          dueDate: true,
          appliedDate: true,
          description: false,
          Resume: true,
        },
        orderBy: {
          createdAt: "desc",
          // appliedDate: "desc",
        },
      }),
      prisma.job.count({
        where: whereClause,
      }),
    ]);
    return { success: true, data, total };
  } catch (error) {
    const msg = "Failed to fetch jobs list. ";
    return handleError(error, msg);
  }
};

export async function* getJobsIterator(filter?: string, pageSize = 200) {
  const user = await requireUser();
  let page = 1;
  let fetchedCount = 0;

  while (true) {
    const skip = (page - 1) * pageSize;
    const filterBy = filter
      ? filter === Object.keys(JOB_TYPES)[1]
        ? { status: filter }
        : { type: filter }
      : {};

    const chunk = await prisma.job.findMany({
      where: {
        userId: user.id,
        ...filterBy,
      },
      select: {
        id: true,
        createdAt: true,
        JobSource: true,
        JobTitle: true,
        jobType: true,
        Company: true,
        Status: true,
        Locations: true,
        dueDate: true,
        applied: true,
        appliedDate: true,
      },
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    });

    if (!chunk.length) {
      break;
    }

    yield chunk;
    fetchedCount += chunk.length;
    page++;
  }
}

export const getJobDetails = async (
  jobId: string
): Promise<any | undefined> => {
  try {
    if (!jobId) {
      throw new Error("Please provide job id");
    }
    const user = await requireUser();

    const job = await prisma.job.findUnique({
      where: {
        id: jobId,
      },
      include: {
        JobSource: true,
        JobTitle: true,
        Company: true,
        Status: true,
        Locations: true,
        Resume: {
          include: {
            File: true,
          },
        },
      },
    });
    return { job, success: true };
  } catch (error) {
    const msg = "Failed to fetch job details. ";
    return handleError(error, msg);
  }
};

export const createLocation = async (
  label: string
): Promise<any | undefined> => {
  try {
    const user = await requireUser();

    const value = label.trim().toLowerCase();

    if (!value) {
      throw new Error("Please provide location name");
    }

    const existingLocation = await prisma.location.findFirst({
      where: { value, createdBy: user.id },
    });

    if (existingLocation) {
      return { data: existingLocation, success: true };
    }

    const location = await prisma.location.create({
      data: { label, value, createdBy: user.id },
    });

    return { data: location, success: true };
  } catch (error) {
    const msg = "Failed to create job location. ";
    return handleError(error, msg);
  }
};

export const addJob = async (
  data: z.infer<typeof AddJobFormSchema>
): Promise<any | undefined> => {
  try {
    const user = await requireUser();

    const {
      title,
      company,
      location,
      type,
      status,
      source,
      salaryMin,
      salaryMax,
      dueDate,
      dateApplied,
      jobDescription,
      jobUrl,
      applied,
      resume,
    } = data;

    const job = await prisma.job.create({
      data: {
        jobTitleId: title,
        companyId: company,
        Locations: {
          connect: location.map((id) => ({ id })),
        },
        statusId: status,
        jobSourceId: source,
        salaryMin: salaryMin || null,
        salaryMax: salaryMax || null,
        createdAt: new Date(),
        dueDate: dueDate,
        appliedDate: dateApplied,
        description: jobDescription,
        workArrangement: data.workArrangement || null,
        responsibilities: data.responsibilities || null,
        minimumQualifications: data.minimumQualifications || null,
        preferredQualifications: data.preferredQualifications || null,
        jobType: type,
        userId: user.id,
        jobUrl,
        applied,
        resumeId: resume,
      },
    });
    return { job, success: true };
  } catch (error) {
    const msg = "Failed to create job. ";
    return handleError(error, msg);
  }
};

export const updateJob = async (
  data: z.infer<typeof AddJobFormSchema>
): Promise<any | undefined> => {
  try {
    const user = await requireUser();
    if (!data.id || user.id != data.userId) {
      throw new Error("Id is not provide or no user privilages");
    }

    const {
      id,
      title,
      company,
      location,
      type,
      status,
      source,
      salaryMin,
      salaryMax,
      dueDate,
      dateApplied,
      jobDescription,
      jobUrl,
      applied,
      resume,
    } = data;

    const job = await prisma.job.update({
      where: {
        id,
      },
      data: {
        jobTitleId: title,
        companyId: company,
        Locations: {
          set: location.map((id) => ({ id })),
        },
        statusId: status,
        jobSourceId: source,
        salaryMin: salaryMin || null,
        salaryMax: salaryMax || null,
        createdAt: new Date(),
        dueDate: dueDate,
        appliedDate: dateApplied,
        description: jobDescription,
        workArrangement: data.workArrangement || null,
        responsibilities: data.responsibilities || null,
        minimumQualifications: data.minimumQualifications || null,
        preferredQualifications: data.preferredQualifications || null,
        jobType: type,
        jobUrl,
        applied,
        resumeId: resume,
      },
    });
    return { job, success: true };
  } catch (error) {
    const msg = "Failed to update job. ";
    return handleError(error, msg);
  }
};

export const updateJobStatus = async (
  jobId: string,
  status: JobStatus
): Promise<any | undefined> => {
  try {
    const user = await requireUser();
    const dataToUpdate = () => {
      switch (status.value) {
        case "applied":
          return {
            statusId: status.id,
            applied: true,
            appliedDate: new Date(),
          };
        case "interview":
          return {
            statusId: status.id,
            applied: true,
          };
        default:
          return {
            statusId: status.id,
          };
      }
    };

    const job = await prisma.job.update({
      where: {
        id: jobId,
        userId: user.id,
      },
      data: dataToUpdate(),
    });
    return { job, success: true };
  } catch (error) {
    const msg = "Failed to update job status.";
    return handleError(error, msg);
  }
};

export const deleteJobById = async (
  jobId: string
): Promise<any | undefined> => {
  try {
    const user = await requireUser();

    const res = await prisma.job.delete({
      where: {
        id: jobId,
        userId: user.id,
      },
    });
    return { res, success: true };
  } catch (error) {
    const msg = "Failed to delete job.";
    return handleError(error, msg);
  }
};

export const getJobPipelineInfo = async (
  jobId: string,
  currentSettings?: {
    provider: string;
    model: string;
    numCtx?: number;
    cleaningMethod: string;
  },
) => {
  try {
    await requireUser();
    const latestRun = await prisma.pipelineRun.findFirst({
      where: { jobId },
      orderBy: { createdAt: "desc" },
      select: {
        configHash: true,
        status: true,
        createdAt: true,
      },
    });

    if (!latestRun) {
      return { success: true, hasPipelineData: false } as const;
    }

    let configChanged = false;
    if (currentSettings) {
      const numCtx = currentSettings.numCtx ?? 8192;
      const config: PipelineConfig = {
        cleaner: currentSettings.cleaningMethod as "readability" | "html-strip",
        model: currentSettings.model,
        provider: currentSettings.provider as AiProvider,
        numCtx,
        temperature: 0.1,
        maxInputChars: getTextLimit(currentSettings.provider, numCtx),
      };
      const currentHash = hashPipelineConfig(config);
      configChanged = latestRun.configHash !== currentHash;
    }

    return {
      success: true,
      hasPipelineData: true,
      configHash: latestRun.configHash.substring(0, 8),
      processedAt: latestRun.createdAt,
      status: latestRun.status,
      configChanged,
    } as const;
  } catch (error) {
    return handleError(error, "Failed to fetch pipeline info.");
  }
};
