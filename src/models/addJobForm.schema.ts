import { z } from "zod";

export const AddJobFormSchema = z.object({
  id: z.string().optional(),
  userId: z.string().optional(),
  title: z
    .string({
      error: "Job title is required.",
    })
    .min(2, {
      message: "Job title must be at least 2 characters.",
    }),
  company: z
    .string({
      error: "Company name is required.",
    })
    .min(2, {
      message: "Company name must be at least 2 characters.",
    }),
  location: z
    .array(z.string())
    .min(1, { message: "At least one location is required." }),
  type: z.string().min(1),
  workArrangement: z.string().optional(),
  source: z
    .string({
      error: "Source is required.",
    })
    .min(2, {
      message: "Source name must be at least 2 characters.",
    }),
  status: z
    .string({
      error: "Status is required.",
    })
    .min(2, {
      message: "Status must be at least 2 characters.",
    })
    .default("draft"),
  dueDate: z.date(),
  /**
   * Note: Timezone offsets can be allowed by setting the offset option to true.
   * z.string().datetime({ offset: true });
   */
  //
  dateApplied: z.date().optional(),
  salaryMin: z.preprocess(
    (val) => (val === "" || val === undefined ? undefined : Number(val)),
    z.number().int().min(50000).optional(),
  ),
  salaryMax: z.preprocess(
    (val) => (val === "" || val === undefined ? undefined : Number(val)),
    z.number().int().min(50000).optional(),
  ),
  jobDescription: z
    .string({
      error: "Job description is required.",
    })
    .min(10, {
      message: "Job description must be at least 10 characters.",
    }),
  responsibilities: z.string().optional(),
  minimumQualifications: z.string().optional(),
  preferredQualifications: z.string().optional(),
  jobUrl: z.string().optional(),
  applied: z.boolean().default(false),
  resume: z.string().optional(),
}).refine(
  (data) => {
    if (data.salaryMin != null && data.salaryMax != null) {
      return data.salaryMin <= data.salaryMax;
    }
    return true;
  },
  {
    message: "Minimum salary must not exceed maximum salary.",
    path: ["salaryMax"],
  },
);
