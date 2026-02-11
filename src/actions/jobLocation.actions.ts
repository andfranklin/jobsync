"use server";
import prisma from "@/lib/db";
import { handleError } from "@/lib/utils";
import { requireUser } from "@/utils/user.utils";
import { APP_CONSTANTS } from "@/lib/constants";
import { EditLocationFormSchema } from "@/models/editLocationForm.schema";
import { z } from "zod";

export const getAllJobLocations = async (): Promise<any | undefined> => {
  try {
    const list = await prisma.location.findMany();
    return list;
  } catch (error) {
    const msg = "Failed to fetch job location list. ";
    return handleError(error, msg);
  }
};

export const getJobLocationsList = async (
  page: number = 1,
  limit: number = APP_CONSTANTS.RECORDS_PER_PAGE,
  countBy?: string
): Promise<any | undefined> => {
  try {
    const user = await requireUser();
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.location.findMany({
        where: {
          createdBy: user.id,
        },
        skip,
        take: limit,
        ...(countBy
          ? {
              select: {
                id: true,
                label: true,
                value: true,
                _count: {
                  select: {
                    jobs: true,
                  },
                },
              },
            }
          : {}),
        orderBy: {
          jobs: {
            _count: "desc",
          },
        },
      }),
      prisma.location.count({
        where: {
          createdBy: user.id,
        },
      }),
    ]);
    return { data, total };
  } catch (error) {
    const msg = "Failed to fetch job location list. ";
    return handleError(error, msg);
  }
};

export const getJobLocationById = async (
  locationId: string
): Promise<any | undefined> => {
  try {
    if (!locationId) {
      throw new Error("Please provide location id");
    }
    await requireUser();

    const location = await prisma.location.findUnique({
      where: { id: locationId },
    });
    return location;
  } catch (error) {
    const msg = "Failed to fetch job location by Id. ";
    return handleError(error, msg);
  }
};

export const updateJobLocation = async (
  data: z.infer<typeof EditLocationFormSchema>
): Promise<any | undefined> => {
  try {
    const user = await requireUser();

    const { id, label, createdBy } = data;

    if (!id || user.id !== createdBy) {
      throw new Error("Id is not provided or no user privileges");
    }

    const value = label.trim().toLowerCase();

    const existing = await prisma.location.findFirst({
      where: { value, createdBy: user.id },
    });

    if (existing && existing.id !== id) {
      throw new Error("Location already exists!");
    }

    const res = await prisma.location.update({
      where: { id },
      data: { value, label },
    });

    return { success: true, data: res };
  } catch (error) {
    const msg = "Failed to update job location.";
    return handleError(error, msg);
  }
};

export const getLocationDependencies = async (
  locationId: string
): Promise<any | undefined> => {
  try {
    await requireUser();

    const [jobCount, workExpCount, educationCount] = await Promise.all([
      prisma.job.count({
        where: { Locations: { some: { id: locationId } } },
      }),
      prisma.workExperience.count({
        where: { locationId },
      }),
      prisma.education.count({
        where: { locationId },
      }),
    ]);

    return { success: true, jobCount, workExpCount, educationCount };
  } catch (error) {
    const msg = "Failed to fetch location dependencies.";
    return handleError(error, msg);
  }
};

export const mergeJobLocations = async (
  sourceId: string,
  targetId: string
): Promise<any | undefined> => {
  try {
    const user = await requireUser();

    if (sourceId === targetId) {
      throw new Error("Source and target locations must be different");
    }

    await prisma.$transaction(async (tx) => {
      // Verify both locations exist and belong to user
      const [source, target] = await Promise.all([
        tx.location.findUnique({ where: { id: sourceId, createdBy: user.id } }),
        tx.location.findUnique({ where: { id: targetId, createdBy: user.id } }),
      ]);

      if (!source) throw new Error("Source location not found");
      if (!target) throw new Error("Target location not found");

      // 1. Jobs (many-to-many): disconnect source, connect target (avoiding duplicates)
      const jobsWithSource = await tx.job.findMany({
        where: { Locations: { some: { id: sourceId } } },
        select: { id: true, Locations: { select: { id: true } } },
      });

      for (const job of jobsWithSource) {
        const alreadyHasTarget = job.Locations.some(
          (loc) => loc.id === targetId
        );
        await tx.job.update({
          where: { id: job.id },
          data: {
            Locations: {
              disconnect: { id: sourceId },
              ...(alreadyHasTarget ? {} : { connect: { id: targetId } }),
            },
          },
        });
      }

      // 2. WorkExperience (FK): reassign locationId
      await tx.workExperience.updateMany({
        where: { locationId: sourceId },
        data: { locationId: targetId },
      });

      // 3. Education (FK): reassign locationId
      await tx.education.updateMany({
        where: { locationId: sourceId },
        data: { locationId: targetId },
      });

      // 4. Delete source location
      await tx.location.delete({
        where: { id: sourceId, createdBy: user.id },
      });
    });

    return { success: true };
  } catch (error) {
    const msg = "Failed to merge locations.";
    return handleError(error, msg);
  }
};

export const deleteJobLocationById = async (
  locationId: string
): Promise<any | undefined> => {
  try {
    const user = await requireUser();

    const experiences = await prisma.workExperience.count({
      where: {
        locationId,
      },
    });
    if (experiences > 0) {
      throw new Error(
        `Job location cannot be deleted due to its use in experience section of one of the resume! `
      );
    }

    const educations = await prisma.education.count({
      where: {
        locationId,
      },
    });
    if (educations > 0) {
      throw new Error(
        `Job location cannot be deleted due to its use in education section of one of the resume! `
      );
    }

    const jobs = await prisma.job.count({
      where: {
        Locations: {
          some: {
            id: locationId,
          },
        },
      },
    });

    if (jobs > 0) {
      throw new Error(
        `Location cannot be deleted due to ${jobs} number of associated jobs! `
      );
    }

    const res = await prisma.location.delete({
      where: {
        id: locationId,
        createdBy: user.id,
      },
    });
    return { res, success: true };
  } catch (error) {
    const msg = "Failed to delete job location.";
    return handleError(error, msg);
  }
};
