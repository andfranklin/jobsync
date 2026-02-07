import { z } from "zod";

export const JobExtractionSchema = z.object({
  title: z.string().describe("The exact job title as stated in the posting"),
  company: z.string().describe("The company name"),
  locations: z
    .array(z.string())
    .describe(
      "Job locations as an array of strings, e.g. ['San Francisco, CA', 'Remote']",
    ),
  description: z
    .string()
    .describe(
      "The job description, responsibilities, and requirements formatted as clean HTML using <p>, <ul>, <li>, <strong>, and <h2> tags",
    ),
  jobType: z
    .enum(["FT", "PT", "C"])
    .optional()
    .describe(
      "The employment type: FT for full-time, PT for part-time, C for contract. Omit if not specified.",
    ),
  salaryMin: z
    .number()
    .optional()
    .describe(
      "Minimum annual salary as a number without currency symbols, rounded down to the nearest 10000. Omit if not mentioned.",
    ),
  salaryMax: z
    .number()
    .optional()
    .describe(
      "Maximum annual salary as a number without currency symbols, rounded up to the nearest 10000. Omit if not mentioned.",
    ),
});

export type JobExtraction = z.infer<typeof JobExtractionSchema>;
