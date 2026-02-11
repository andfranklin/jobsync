import {
  getJobLocationById,
  updateJobLocation,
  getLocationDependencies,
  mergeJobLocations,
  deleteJobLocationById,
} from "@/actions/jobLocation.actions";
import { requireUser } from "@/utils/user.utils";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Mock the Prisma Client
jest.mock("@prisma/client", () => {
  const mPrismaClient = {
    location: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    job: {
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    workExperience: {
      count: jest.fn(),
      updateMany: jest.fn(),
    },
    education: {
      count: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  return { PrismaClient: jest.fn(() => mPrismaClient) };
});

jest.mock("@/utils/user.utils", () => ({
  getCurrentUser: jest.fn(),
  requireUser: jest.fn(),
}));

describe("jobLocation.actions", () => {
  const mockUser = { id: "user-id" };

  beforeEach(() => {
    jest.clearAllMocks();
    (requireUser as jest.Mock).mockResolvedValue(mockUser);
  });

  describe("getJobLocationById", () => {
    it("should return location on success", async () => {
      const mockLocation = {
        id: "loc-1",
        label: "New York, NY",
        value: "new york, ny",
        createdBy: mockUser.id,
      };
      (prisma.location.findUnique as jest.Mock).mockResolvedValue(
        mockLocation
      );

      const result = await getJobLocationById("loc-1");

      expect(prisma.location.findUnique).toHaveBeenCalledWith({
        where: { id: "loc-1" },
      });
      expect(result).toEqual(mockLocation);
    });

    it("should throw if no id provided", async () => {
      const result = await getJobLocationById("");

      expect(result).toEqual({
        success: false,
        message: expect.stringContaining("Please provide location id"),
      });
    });
  });

  describe("updateJobLocation", () => {
    it("should update location on success", async () => {
      const data = {
        id: "loc-1",
        label: "San Francisco, CA",
        createdBy: mockUser.id,
      };
      (prisma.location.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.location.update as jest.Mock).mockResolvedValue({
        id: "loc-1",
        label: "San Francisco, CA",
        value: "san francisco, ca",
      });

      const result = await updateJobLocation(data);

      expect(prisma.location.findFirst).toHaveBeenCalledWith({
        where: { value: "san francisco, ca", createdBy: mockUser.id },
      });
      expect(prisma.location.update).toHaveBeenCalledWith({
        where: { id: "loc-1" },
        data: { value: "san francisco, ca", label: "San Francisco, CA" },
      });
      expect(result).toEqual({
        success: true,
        data: expect.objectContaining({ id: "loc-1" }),
      });
    });

    it("should fail if duplicate value exists", async () => {
      const data = {
        id: "loc-1",
        label: "New York, NY",
        createdBy: mockUser.id,
      };
      (prisma.location.findFirst as jest.Mock).mockResolvedValue({
        id: "loc-2",
        value: "new york, ny",
      });

      const result = await updateJobLocation(data);

      expect(result).toEqual({
        success: false,
        message: expect.stringContaining("Location already exists"),
      });
    });

    it("should fail if id is missing", async () => {
      const data = { label: "Test", createdBy: mockUser.id };

      const result = await updateJobLocation(data);

      expect(result).toEqual({
        success: false,
        message: expect.stringContaining("Id is not provided"),
      });
    });

    it("should fail if createdBy does not match user", async () => {
      const data = {
        id: "loc-1",
        label: "Test",
        createdBy: "other-user",
      };

      const result = await updateJobLocation(data);

      expect(result).toEqual({
        success: false,
        message: expect.stringContaining("Id is not provided"),
      });
    });
  });

  describe("getLocationDependencies", () => {
    it("should return correct counts", async () => {
      (prisma.job.count as jest.Mock).mockResolvedValue(3);
      (prisma.workExperience.count as jest.Mock).mockResolvedValue(1);
      (prisma.education.count as jest.Mock).mockResolvedValue(2);

      const result = await getLocationDependencies("loc-1");

      expect(result).toEqual({
        success: true,
        jobCount: 3,
        workExpCount: 1,
        educationCount: 2,
      });
      expect(prisma.job.count).toHaveBeenCalledWith({
        where: { Locations: { some: { id: "loc-1" } } },
      });
      expect(prisma.workExperience.count).toHaveBeenCalledWith({
        where: { locationId: "loc-1" },
      });
      expect(prisma.education.count).toHaveBeenCalledWith({
        where: { locationId: "loc-1" },
      });
    });
  });

  describe("mergeJobLocations", () => {
    it("should fail if source and target are the same", async () => {
      const result = await mergeJobLocations("loc-1", "loc-1");

      expect(result).toEqual({
        success: false,
        message: expect.stringContaining(
          "Source and target locations must be different"
        ),
      });
    });

    it("should execute merge transaction on success", async () => {
      // $transaction receives a callback; we execute it with a mock tx
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        const tx = {
          location: {
            findUnique: jest.fn(),
            delete: jest.fn(),
          },
          job: {
            findMany: jest.fn(),
            update: jest.fn(),
          },
          workExperience: {
            updateMany: jest.fn(),
          },
          education: {
            updateMany: jest.fn(),
          },
        };

        // Source and target exist
        tx.location.findUnique
          .mockResolvedValueOnce({
            id: "loc-1",
            label: "NYC",
            createdBy: mockUser.id,
          })
          .mockResolvedValueOnce({
            id: "loc-2",
            label: "New York",
            createdBy: mockUser.id,
          });

        // Two jobs linked to source: one already has target, one doesn't
        tx.job.findMany.mockResolvedValue([
          {
            id: "job-1",
            Locations: [{ id: "loc-1" }, { id: "loc-2" }],
          },
          {
            id: "job-2",
            Locations: [{ id: "loc-1" }],
          },
        ]);

        tx.workExperience.updateMany.mockResolvedValue({ count: 1 });
        tx.education.updateMany.mockResolvedValue({ count: 0 });
        tx.location.delete.mockResolvedValue({});

        await fn(tx);

        // job-1 already has target, so only disconnect
        expect(tx.job.update).toHaveBeenCalledWith({
          where: { id: "job-1" },
          data: {
            Locations: {
              disconnect: { id: "loc-1" },
            },
          },
        });

        // job-2 does not have target, so disconnect + connect
        expect(tx.job.update).toHaveBeenCalledWith({
          where: { id: "job-2" },
          data: {
            Locations: {
              disconnect: { id: "loc-1" },
              connect: { id: "loc-2" },
            },
          },
        });

        expect(tx.workExperience.updateMany).toHaveBeenCalledWith({
          where: { locationId: "loc-1" },
          data: { locationId: "loc-2" },
        });

        expect(tx.education.updateMany).toHaveBeenCalledWith({
          where: { locationId: "loc-1" },
          data: { locationId: "loc-2" },
        });

        expect(tx.location.delete).toHaveBeenCalledWith({
          where: { id: "loc-1", createdBy: mockUser.id },
        });
      });

      const result = await mergeJobLocations("loc-1", "loc-2");

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ success: true });
    });

    it("should fail if source location not found", async () => {
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        const tx = {
          location: {
            findUnique: jest
              .fn()
              .mockResolvedValueOnce(null)
              .mockResolvedValueOnce({
                id: "loc-2",
                createdBy: mockUser.id,
              }),
          },
        };
        await fn(tx);
      });

      const result = await mergeJobLocations("loc-1", "loc-2");

      expect(result).toEqual({
        success: false,
        message: expect.stringContaining("Source location not found"),
      });
    });

    it("should fail if target location not found", async () => {
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        const tx = {
          location: {
            findUnique: jest
              .fn()
              .mockResolvedValueOnce({
                id: "loc-1",
                createdBy: mockUser.id,
              })
              .mockResolvedValueOnce(null),
          },
        };
        await fn(tx);
      });

      const result = await mergeJobLocations("loc-1", "loc-2");

      expect(result).toEqual({
        success: false,
        message: expect.stringContaining("Target location not found"),
      });
    });
  });

  describe("deleteJobLocationById", () => {
    it("should delete location with no dependencies", async () => {
      (prisma.workExperience.count as jest.Mock).mockResolvedValue(0);
      (prisma.education.count as jest.Mock).mockResolvedValue(0);
      (prisma.job.count as jest.Mock).mockResolvedValue(0);
      (prisma.location.delete as jest.Mock).mockResolvedValue({ id: "loc-1" });

      const result = await deleteJobLocationById("loc-1");

      expect(result).toEqual({
        res: { id: "loc-1" },
        success: true,
      });
    });

    it("should fail if location has associated jobs", async () => {
      (prisma.workExperience.count as jest.Mock).mockResolvedValue(0);
      (prisma.education.count as jest.Mock).mockResolvedValue(0);
      (prisma.job.count as jest.Mock).mockResolvedValue(3);

      const result = await deleteJobLocationById("loc-1");

      expect(result).toEqual({
        success: false,
        message: expect.stringContaining("associated jobs"),
      });
    });

    it("should fail if location is used in work experience", async () => {
      (prisma.workExperience.count as jest.Mock).mockResolvedValue(1);

      const result = await deleteJobLocationById("loc-1");

      expect(result).toEqual({
        success: false,
        message: expect.stringContaining("experience section"),
      });
    });

    it("should fail if location is used in education", async () => {
      (prisma.workExperience.count as jest.Mock).mockResolvedValue(0);
      (prisma.education.count as jest.Mock).mockResolvedValue(1);

      const result = await deleteJobLocationById("loc-1");

      expect(result).toEqual({
        success: false,
        message: expect.stringContaining("education section"),
      });
    });
  });
});
