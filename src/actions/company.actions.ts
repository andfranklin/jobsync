"use server";
import prisma from "@/lib/db";
import { handleError } from "@/lib/utils";
import { AddCompanyFormSchema } from "@/models/addCompanyForm.schema";
import { requireUser } from "@/utils/user.utils";
import { APP_CONSTANTS } from "@/lib/constants";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export const getCompanyList = async (
  page: number = 1,
  limit: number = APP_CONSTANTS.RECORDS_PER_PAGE,
  countBy?: string,
): Promise<any | undefined> => {
  try {
    const user = await requireUser();
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.company.findMany({
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
                logoUrl: true,
                careerPageUrl: true,
                description: true,
                _count: {
                  select: {
                    jobsApplied: {
                      where: {
                        applied: true,
                      },
                    },
                  },
                },
              },
            }
          : {}),
        orderBy: {
          jobsApplied: {
            _count: "desc",
          },
        },
      }),
      prisma.company.count({
        where: {
          createdBy: user.id,
        },
      }),
    ]);
    return { data, total };
  } catch (error) {
    const msg = "Failed to fetch company list. ";
    return handleError(error, msg);
  }
};

export const getAllCompanies = async (): Promise<any | undefined> => {
  try {
    const user = await requireUser();

    const companies = await prisma.company.findMany({
      where: {
        createdBy: user.id,
      },
    });
    return companies;
  } catch (error) {
    const msg = "Failed to fetch all companies. ";
    return handleError(error, msg);
  }
};

export const addCompany = async (
  data: z.infer<typeof AddCompanyFormSchema>,
): Promise<any | undefined> => {
  try {
    const user = await requireUser();

    const { company, careerPageUrl, logoUrl, description } = data;
    const value = company.trim().toLowerCase();

    const res = await prisma.company.upsert({
      where: { value },
      update: {},
      create: {
        createdBy: user.id,
        value,
        label: company,
        logoUrl: logoUrl || null,
        careerPageUrl: careerPageUrl || null,
        description: description || null,
      },
    });
    revalidatePath("/dashboard/myjobs", "page");
    return { success: true, data: res };
  } catch (error) {
    const msg = "Failed to create company.";
    return handleError(error, msg);
  }
};

export const updateCompany = async (
  data: z.infer<typeof AddCompanyFormSchema>,
): Promise<any | undefined> => {
  try {
    const user = await requireUser();

    const { id, company, careerPageUrl, logoUrl, description, createdBy } = data;

    if (!id || user.id != createdBy) {
      throw new Error("Id is not provided or no user privilages");
    }

    const value = company.trim().toLowerCase();

    const companyExists = await prisma.company.findUnique({
      where: {
        value,
      },
    });

    if (companyExists && companyExists.id !== id) {
      throw new Error("Company already exists!");
    }

    const res = await prisma.company.update({
      where: {
        id,
      },
      data: {
        value,
        label: company,
        logoUrl: logoUrl || null,
        careerPageUrl: careerPageUrl || null,
        description: description || null,
      },
    });

    return { success: true, data: res };
  } catch (error) {
    const msg = "Failed to update company.";
    return handleError(error, msg);
  }
};

export const getCompanyById = async (
  companyId: string,
): Promise<any | undefined> => {
  try {
    if (!companyId) {
      throw new Error("Please provide company id");
    }
    const user = await requireUser();

    const company = await prisma.company.findUnique({
      where: {
        id: companyId,
      },
    });
    return company;
  } catch (error) {
    const msg = "Failed to fetch company by Id. ";
    return handleError(error, msg);
  }
};

export const updateCompanyDescription = async (
  companyId: string,
  description: string,
): Promise<any | undefined> => {
  try {
    const user = await requireUser();

    const res = await prisma.company.update({
      where: {
        id: companyId,
        createdBy: user.id,
      },
      data: {
        description,
      },
    });

    return { success: true, data: res };
  } catch (error) {
    const msg = "Failed to update company description.";
    return handleError(error, msg);
  }
};

export const enrichCompanyFromScrape = async (
  companyId: string,
  details: { description?: string | null; logoUrl?: string | null },
): Promise<any | undefined> => {
  try {
    const user = await requireUser();

    const data: Record<string, string | null> = {};
    if (details.description) data.description = details.description;
    if (details.logoUrl) data.logoUrl = details.logoUrl;

    if (Object.keys(data).length === 0) return { success: true };

    const res = await prisma.company.update({
      where: { id: companyId, createdBy: user.id },
      data,
    });

    return { success: true, data: res };
  } catch (error) {
    return handleError(error, "Failed to enrich company details. ");
  }
};

export const deleteCompanyById = async (
  companyId: string,
): Promise<any | undefined> => {
  try {
    const user = await requireUser();

    const experiences = await prisma.workExperience.count({
      where: {
        companyId,
      },
    });
    if (experiences > 0) {
      throw new Error(
        `Company cannot be deleted due to its use in experience section of one of the resume! `,
      );
    }
    const jobs = await prisma.job.count({
      where: {
        companyId,
      },
    });

    if (jobs > 0) {
      throw new Error(
        `Company cannot be deleted due to ${jobs} number of associated jobs! `,
      );
    }

    const res = await prisma.company.delete({
      where: {
        id: companyId,
        createdBy: user.id,
      },
    });
    return { res, success: true };
  } catch (error) {
    const msg = "Failed to delete company.";
    return handleError(error, msg);
  }
};
