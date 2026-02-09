"use client";

import { useState } from "react";
import { UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { AddJobFormSchema } from "@/models/addJobForm.schema";
import { JobExtraction } from "@/models/jobExtraction.schema";
import { Company, JobLocation, JobSource, JobTitle } from "@/models/job.model";
import { SALARY_VALUES } from "@/lib/data/salaryRangeData";
import { createLocation } from "@/actions/job.actions";
import { addCompany } from "@/actions/company.actions";
import { createJobTitle } from "@/actions/jobtitle.actions";
import { getFromLocalStorage } from "@/utils/localstorage.utils";
import { toast } from "../ui/use-toast";

type FormValues = z.infer<typeof AddJobFormSchema>;

type UseJobExtractionParams = {
  form: UseFormReturn<FormValues>;
  jobSources: JobSource[];
  jobTitles: JobTitle[];
  companies: Company[];
  locations: JobLocation[];
  setEditorKey: React.Dispatch<React.SetStateAction<number>>;
};

export function useJobExtraction({
  form,
  jobSources,
  jobTitles,
  companies,
  locations,
  setEditorKey,
}: UseJobExtractionParams) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [showPasteInput, setShowPasteInput] = useState(false);
  const [pasteContent, setPasteContent] = useState("");

  const { setValue } = form;

  const detectSourceFromUrl = (url: string): string | undefined => {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      const domainMap: Record<string, string> = {
        indeed: "indeed",
        linkedin: "linkedin",
        monster: "monster",
        glassdoor: "glassdoor",
        google: "google",
        ziprecruiter: "ziprecruiter",
        jobstreet: "jobstreet",
      };
      for (const [domain, value] of Object.entries(domainMap)) {
        if (hostname.includes(domain)) {
          return jobSources.find((s) => s.value === value)?.id;
        }
      }
      return jobSources.find((s) => s.value === "careerpage")?.id;
    } catch {
      return undefined;
    }
  };

  const snapToSalaryValue = (amount: number): number | undefined => {
    if (amount < 50000) return undefined;
    const snapped = SALARY_VALUES.reduce((prev, curr) =>
      Math.abs(curr.value - amount) < Math.abs(prev.value - amount)
        ? curr
        : prev,
    ).value;
    return snapped;
  };

  const findMatchingEntity = (
    label: string,
    entities: { id: string; value: string; label: string }[],
  ): string | undefined => {
    const normalized = label.trim().toLowerCase();
    const match = entities.find(
      (e) =>
        e.value === normalized ||
        e.value.includes(normalized) ||
        normalized.includes(e.value),
    );
    return match?.id;
  };

  const fillFormFromExtraction = async (extracted: JobExtraction) => {
    const currentValues = form.getValues();

    // Job Title
    if (!currentValues.title) {
      const matchedId = findMatchingEntity(extracted.title, jobTitles);
      if (matchedId) {
        setValue("title", matchedId);
      } else {
        const created = await createJobTitle(extracted.title);
        if (created?.id) {
          jobTitles.unshift(created);
          setValue("title", created.id);
        }
      }
    }

    // Company
    if (!currentValues.company) {
      const matchedId = findMatchingEntity(extracted.company, companies);
      if (matchedId) {
        setValue("company", matchedId);
      } else {
        const result = await addCompany({ company: extracted.company });
        if (result?.success && result.data?.id) {
          companies.unshift(result.data);
          setValue("company", result.data.id);
        }
      }
    }

    // Locations
    if (!currentValues.location || currentValues.location.length === 0) {
      const locationIds: string[] = [];
      for (const loc of extracted.locations) {
        const matchedId = findMatchingEntity(loc, locations);
        if (matchedId) {
          locationIds.push(matchedId);
        } else {
          const result = await createLocation(loc);
          if (result?.success && result.data?.id) {
            locations.unshift(result.data);
            locationIds.push(result.data.id);
          }
        }
      }
      if (locationIds.length > 0) {
        setValue("location", locationIds);
      }
    }

    // Source (detect from URL)
    if (!currentValues.source) {
      const jobUrl = currentValues.jobUrl;
      if (jobUrl) {
        const sourceId = detectSourceFromUrl(jobUrl);
        if (sourceId) {
          setValue("source", sourceId);
        }
      }
    }

    // Job Type
    if (extracted.jobType) {
      setValue("type", extracted.jobType);
    }

    // Salary
    if (currentValues.salaryMin == null && extracted.salaryMin != null) {
      const snapped = snapToSalaryValue(extracted.salaryMin);
      if (snapped) setValue("salaryMin", snapped);
    }
    if (currentValues.salaryMax == null && extracted.salaryMax != null) {
      const snapped = snapToSalaryValue(extracted.salaryMax);
      if (snapped) setValue("salaryMax", snapped);
    }

    // Description
    if (!currentValues.jobDescription) {
      setValue("jobDescription", extracted.description);
      setEditorKey((k) => k + 1);
    }
  };

  const getSelectedModel = () => {
    const selectedModel = getFromLocalStorage("aiSettings", null);
    if (!selectedModel) {
      toast({
        variant: "destructive",
        title: "No AI model configured",
        description: "Configure an AI model in Settings first.",
      });
      return null;
    }
    return selectedModel;
  };

  const processExtractResponse = async (res: Response) => {
    if (!res.ok) {
      const err = await res.json();
      const status = res.status;
      toast({
        variant: "destructive",
        title: "Auto-fill failed",
        description: err.error || "An error occurred.",
      });
      if (status === 422) {
        setShowPasteInput(true);
      }
      return;
    }

    const extracted: JobExtraction = await res.json();
    await fillFormFromExtraction(extracted);
    setShowPasteInput(false);
    setPasteContent("");

    toast({
      variant: "success",
      description: "Form auto-filled from job posting.",
    });
  };

  const handleAutoFill = async (url: string) => {
    const selectedModel = getSelectedModel();
    if (!selectedModel) return;
    setIsExtracting(true);

    try {
      const res = await fetch("/api/ai/job/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, selectedModel }),
      });
      await processExtractResponse(res);
    } catch {
      toast({
        variant: "destructive",
        title: "Auto-fill failed",
        description: "Network error. Check your connection.",
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleAutoFillFromPaste = async () => {
    const selectedModel = getSelectedModel();
    if (!selectedModel) return;
    setIsExtracting(true);

    try {
      const res = await fetch("/api/ai/job/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ htmlContent: pasteContent, selectedModel }),
      });
      await processExtractResponse(res);
    } catch {
      toast({
        variant: "destructive",
        title: "Auto-fill failed",
        description: "Network error. Check your connection.",
      });
    } finally {
      setIsExtracting(false);
    }
  };

  return {
    isExtracting,
    showPasteInput,
    setShowPasteInput,
    pasteContent,
    setPasteContent,
    handleAutoFill,
    handleAutoFillFromPaste,
  };
}
