import { z } from "zod";

export const JobExtractionSchema = z.object({
  title: z.string().describe("The core job title only — omit department, team, or group suffixes that appear after a comma or dash"),
  company: z.string().describe("The company name"),
  locations: z
    .array(z.string())
    .describe(
      "Job locations as an array of strings, e.g. ['San Francisco, CA', 'Remote']. Only actual work locations — never legal notices or ordinances.",
    ),
  description: z
    .string()
    .describe(
      "A concise third-person summary of the role (~500 words max) as clean HTML. Do NOT include responsibilities or qualifications. Use neutral voice (never 'we' or 'you').",
    ),
  jobType: z
    .enum(["FT", "PT", "C"])
    .optional()
    .describe(
      "The employment type: FT for full-time, PT for part-time, C for contract. Omit if not specified.",
    ),
  workArrangement: z
    .enum(["REMOTE", "HYBRID", "IN_OFFICE"])
    .optional()
    .describe(
      "The work arrangement: REMOTE, HYBRID, or IN_OFFICE. Omit if not specified.",
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
  responsibilities: z
    .array(z.string())
    .max(7)
    .optional()
    .describe(
      "Key responsibilities as short bullet-point strings, max 7 items. Omit if not found or not reasonably extrapolatable.",
    ),
  minimumQualifications: z
    .array(z.string())
    .optional()
    .describe(
      "Bare-minimum qualifications or requirements for a candidate to be considered. Omit if not found.",
    ),
  preferredQualifications: z
    .array(z.string())
    .optional()
    .describe(
      "Qualities or experience that would make a strong candidate. Omit if not found.",
    ),
});

export type JobExtraction = z.infer<typeof JobExtractionSchema>;
