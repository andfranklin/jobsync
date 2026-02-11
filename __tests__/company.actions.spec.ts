import {
  addCompany,
  getAllCompanies,
  getCompanyById,
  getCompanyList,
  updateCompany,
  updateCompanyDescription,
} from "@/actions/company.actions";
import { getCurrentUser, requireUser } from "@/utils/user.utils";
import { revalidatePath } from "next/cache";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Mock the Prisma Client
jest.mock("@prisma/client", () => {
  const mPrismaClient = {
    company: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
  };
  return { PrismaClient: jest.fn(() => mPrismaClient) };
});

jest.mock("@/utils/user.utils", () => ({
  getCurrentUser: jest.fn(),
  requireUser: jest.fn(),
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

describe("Company Actions", () => {
  const mockUser = { id: "user-id" };

  beforeEach(() => {
    jest.clearAllMocks();
    (requireUser as jest.Mock).mockResolvedValue(mockUser);
  });
  describe("getCompanyList", () => {
    it("should return company list for authenticated user", async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      const mockData = [
        {
          id: "company-id",
          label: "Company 1",
          value: "company1",
          logoUrl: "logo.png",
        },
      ];
      const mockTotal = 1;

      (prisma.company.findMany as jest.Mock).mockResolvedValue(mockData);
      (prisma.company.count as jest.Mock).mockResolvedValue(mockTotal);

      const result = await getCompanyList(1, 10);

      expect(result).toEqual({ data: mockData, total: mockTotal });
      expect(prisma.company.findMany).toHaveBeenCalledWith({
        where: { createdBy: mockUser.id },
        skip: 0,
        take: 10,
        orderBy: { jobsApplied: { _count: "desc" } },
      });
      expect(prisma.company.count).toHaveBeenCalledWith({
        where: { createdBy: mockUser.id },
      });
    });

    it("should throw an error for unauthenticated user", async () => {
      (requireUser as jest.Mock).mockRejectedValue(
        new Error("Not authenticated")
      );

      await expect(getCompanyList(1, 10)).resolves.toStrictEqual({
        success: false,
        message: "Not authenticated",
      });

      expect(prisma.company.findMany).not.toHaveBeenCalled();
      expect(prisma.company.count).not.toHaveBeenCalled();
    });

    it("should filter by status when countBy is provided", async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      const mockData = [
        {
          id: "company-id",
          label: "Company 1",
          value: "company1",
          logoUrl: "logo.png",
        },
      ];
      const mockTotal = 1;

      (prisma.company.findMany as jest.Mock).mockResolvedValue(mockData);
      (prisma.company.count as jest.Mock).mockResolvedValue(mockTotal);

      const result = await getCompanyList(1, 10, "applied");

      expect(result).toEqual({ data: mockData, total: mockTotal });
      expect(prisma.company.findMany).toHaveBeenCalledWith({
        where: { createdBy: mockUser.id },
        skip: 0,
        take: 10,
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
        orderBy: { jobsApplied: { _count: "desc" } },
      });
      expect(prisma.company.count).toHaveBeenCalledWith({
        where: { createdBy: mockUser.id },
      });
    });

    it("should handle errors", async () => {
      (requireUser as jest.Mock).mockRejectedValue(
        new Error("Database error"),
      );

      await expect(getCompanyList(1, 10)).resolves.toStrictEqual({
        success: false,
        message: "Database error",
      });

      expect(prisma.company.findMany).not.toHaveBeenCalled();
      expect(prisma.company.count).not.toHaveBeenCalled();
    });
  });

  describe("getAllCompanies", () => {
    it("should return all companies for authenticated user", async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      const mockCompanies = [
        { id: "company1", name: "Company 1" },
        { id: "company2", name: "Company 2" },
      ];

      (prisma.company.findMany as jest.Mock).mockResolvedValue(mockCompanies);

      const result = await getAllCompanies();

      expect(result).toEqual(mockCompanies);
      expect(prisma.company.findMany).toHaveBeenCalledWith({
        where: { createdBy: mockUser.id },
      });
    });

    it("should throw an error for unauthenticated user", async () => {
      (requireUser as jest.Mock).mockRejectedValue(
        new Error("Not authenticated")
      );

      await expect(getAllCompanies()).resolves.toStrictEqual({
        success: false,
        message: "Not authenticated",
      });

      expect(prisma.company.findMany).not.toHaveBeenCalled();
    });

    it("should handle unexpected errors", async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.company.findMany as jest.Mock).mockRejectedValue(
        new Error("Unexpected error"),
      );

      const result = await getAllCompanies();

      expect(result).toEqual({ success: false, message: "Unexpected error" });
      expect(prisma.company.findMany).toHaveBeenCalledWith({
        where: { createdBy: mockUser.id },
      });
    });
  });

  describe("addCompany", () => {
    const validData = {
      company: "New Company",
      careerPageUrl: "https://example.com/careers",
      logoUrl: "/images/favicons/new-company.png",
      description: "<p>A great company.</p>",
    };

    it("should create a new company successfully", async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      const mockCompany = {
        id: "company-id",
        label: "New Company",
        value: "new company",
        logoUrl: "/images/favicons/new-company.png",
        careerPageUrl: "https://example.com/careers",
        description: "<p>A great company.</p>",
        createdBy: mockUser.id,
      };
      (prisma.company.upsert as jest.Mock).mockResolvedValue(mockCompany);
      (revalidatePath as jest.Mock).mockResolvedValue(undefined);

      const result = await addCompany(validData);

      expect(result).toEqual({ success: true, data: mockCompany });
      expect(prisma.company.upsert).toHaveBeenCalledWith({
        where: { value: "new company" },
        update: {},
        create: {
          createdBy: mockUser.id,
          value: "new company",
          label: "New Company",
          logoUrl: "/images/favicons/new-company.png",
          careerPageUrl: "https://example.com/careers",
          description: "<p>A great company.</p>",
        },
      });
      expect(revalidatePath).toHaveBeenCalledWith("/dashboard/myjobs", "page");
    });

    it("should return an error if the user is not authenticated", async () => {
      (requireUser as jest.Mock).mockRejectedValue(
        new Error("Not authenticated")
      );

      const result = await addCompany(validData);

      expect(result).toEqual({ success: false, message: "Not authenticated" });
      expect(prisma.company.upsert).not.toHaveBeenCalled();
    });

    it("should handle unexpected errors", async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.company.upsert as jest.Mock).mockRejectedValue(
        new Error("Unexpected error"),
      );

      const result = await addCompany(validData);

      expect(result).toEqual({ success: false, message: "Unexpected error" });
      expect(prisma.company.upsert).toHaveBeenCalled();
    });

    it("should handle missing optional fields", async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      const mockCompany = {
        id: "company-id",
        label: "New Company",
        value: "new company",
        logoUrl: null,
        careerPageUrl: null,
        description: null,
        createdBy: mockUser.id,
      };
      (prisma.company.upsert as jest.Mock).mockResolvedValue(mockCompany);
      (revalidatePath as jest.Mock).mockResolvedValue(undefined);

      const result = await addCompany({ company: "New Company" });

      expect(result).toEqual({ success: true, data: mockCompany });
      expect(prisma.company.upsert).toHaveBeenCalledWith({
        where: { value: "new company" },
        update: {},
        create: {
          createdBy: mockUser.id,
          value: "new company",
          label: "New Company",
          logoUrl: null,
          careerPageUrl: null,
          description: null,
        },
      });
    });
  });

  describe("updateCompany", () => {
    const validData = {
      id: "company-id",
      company: "Updated Company",
      careerPageUrl: "https://example.com/careers",
      logoUrl: "/images/favicons/updated-company.png",
      description: "<p>Updated description.</p>",
      createdBy: "user-id",
    };

    it("should update a company successfully", async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

      (prisma.company.findUnique as jest.Mock).mockResolvedValue(null);

      const mockUpdatedCompany = {
        id: "company-id",
        value: "updated company",
      };

      (prisma.company.update as jest.Mock).mockResolvedValue(
        mockUpdatedCompany,
      );

      const result = await updateCompany(validData);

      expect(result).toEqual({ success: true, data: mockUpdatedCompany });

      expect(prisma.company.findUnique).toHaveBeenCalledWith({
        where: { value: "updated company" },
      });

      expect(prisma.company.update).toHaveBeenCalledWith({
        where: { id: "company-id" },
        data: {
          value: "updated company",
          label: "Updated Company",
          logoUrl: "/images/favicons/updated-company.png",
          careerPageUrl: "https://example.com/careers",
          description: "<p>Updated description.</p>",
        },
      });
    });

    it("should return error if user is not authenticated", async () => {
      (requireUser as jest.Mock).mockRejectedValue(
        new Error("Not authenticated")
      );

      const result = await updateCompany(validData);

      expect(result).toEqual({ success: false, message: "Not authenticated" });

      expect(prisma.company.findUnique).not.toHaveBeenCalled();
      expect(prisma.company.update).not.toHaveBeenCalled();
    });

    it("should return error if company already exists", async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

      (prisma.company.findUnique as jest.Mock).mockResolvedValue({
        id: "existing-company-id",
      });

      const result = await updateCompany(validData);

      expect(result).toEqual({
        success: false,
        message: "Company already exists!",
      });

      expect(prisma.company.update).not.toHaveBeenCalled();
    });

    it("should return error if id is not provided or no user privileges", async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

      const invalidData = { ...validData, id: "", createdBy: "other-user-id" };

      const result = await updateCompany(invalidData);

      expect(result).toEqual({
        success: false,
        message: "Id is not provided or no user privilages",
      });

      expect(prisma.company.findUnique).not.toHaveBeenCalled();
      expect(prisma.company.update).not.toHaveBeenCalled();
    });
  });

  describe("updateCompanyDescription", () => {
    it("should update company description successfully", async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      const mockUpdated = { id: "company-id", description: "<p>New desc</p>" };
      (prisma.company.update as jest.Mock).mockResolvedValue(mockUpdated);

      const result = await updateCompanyDescription("company-id", "<p>New desc</p>");

      expect(result).toEqual({ success: true, data: mockUpdated });
      expect(prisma.company.update).toHaveBeenCalledWith({
        where: { id: "company-id", createdBy: mockUser.id },
        data: { description: "<p>New desc</p>" },
      });
    });

    it("should return error if user is not authenticated", async () => {
      (requireUser as jest.Mock).mockRejectedValue(
        new Error("Not authenticated")
      );

      const result = await updateCompanyDescription("company-id", "desc");

      expect(result).toEqual({ success: false, message: "Not authenticated" });
      expect(prisma.company.update).not.toHaveBeenCalled();
    });
  });

  describe("getCompanyById", () => {
    const mockCompanyId = "company-id";
    const mockCompany = {
      id: "company-id",
      label: "Test Company",
      value: "test-company",
      createdBy: "user-id",
      logoUrl: "http://example.com/logo.png",
    };

    it("should fetch company by id successfully", async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

      (prisma.company.findUnique as jest.Mock).mockResolvedValue(mockCompany);

      const result = await getCompanyById(mockCompanyId);

      expect(prisma.company.findUnique).toHaveBeenCalledWith({
        where: { id: mockCompanyId },
      });

      expect(result).toEqual(mockCompany);
    });

    it("should throw error when companyId is not provided", async () => {
      await expect(getCompanyById("")).resolves.toStrictEqual({
        success: false,
        message: "Please provide company id",
      });

      expect(prisma.company.findUnique).not.toHaveBeenCalled();
    });

    it("should throw error when user is not authenticated", async () => {
      (requireUser as jest.Mock).mockRejectedValue(
        new Error("Not authenticated")
      );

      await expect(getCompanyById(mockCompanyId)).resolves.toStrictEqual({
        success: false,
        message: "Not authenticated",
      });

      expect(prisma.company.findUnique).not.toHaveBeenCalled();
    });

    it("should handle unexpected errors", async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.company.findUnique as jest.Mock).mockRejectedValue(
        new Error("Unexpected error"),
      );

      await expect(getCompanyById(mockCompanyId)).resolves.toStrictEqual({
        success: false,
        message: "Unexpected error",
      });

      expect(prisma.company.findUnique).toHaveBeenCalledWith({
        where: { id: mockCompanyId },
      });
    });
  });
});
