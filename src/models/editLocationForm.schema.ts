import { z } from "zod";

export const EditLocationFormSchema = z.object({
  id: z.string().optional(),
  createdBy: z.string().optional(),
  label: z
    .string({
      error: "Location name is required.",
    })
    .min(1, { message: "Location name is required." }),
});
