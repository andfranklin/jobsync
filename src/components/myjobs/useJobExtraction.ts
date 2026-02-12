"use client";

import { useState } from "react";
import { UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { AddJobFormSchema } from "@/models/addJobForm.schema";
import { JobExtraction } from "@/models/jobExtraction.schema";
import { Company, JobLocation, JobSource, JobTitle } from "@/models/job.model";
import { SALARY_VALUES } from "@/lib/data/salaryRangeData";
import { createLocation, createJobSource } from "@/actions/job.actions";
import { addCompany } from "@/actions/company.actions";
import { createJobTitle } from "@/actions/jobtitle.actions";
import { getFromLocalStorage } from "@/utils/localstorage.utils";
import { toast } from "../ui/use-toast";
import { defaultPipelineSettings } from "@/models/pipeline.model";

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

  const detectSourceFromUrl = (url: string): { id: string } | { label: string; value: string } | undefined => {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      const domainMap = [
        { domain: "indeed", value: "indeed", label: "Indeed" },
        { domain: "linkedin", value: "linkedin", label: "LinkedIn" },
        { domain: "monster", value: "monster", label: "Monster" },
        { domain: "glassdoor", value: "glassdoor", label: "Glassdoor" },
        { domain: "google", value: "google", label: "Google" },
        { domain: "ziprecruiter", value: "ziprecruiter", label: "ZipRecruiter" },
        { domain: "jobstreet", value: "jobstreet", label: "Job Street" },
        { domain: "greenhouse", value: "greenhouse", label: "Greenhouse" },
        { domain: "levelsfyi", value: "levelsfyi", label: "Levels.fyi" },
      ];
      for (const { domain, value, label } of domainMap) {
        if (hostname.includes(domain)) {
          const source = jobSources.find((s) => s.value === value);
          if (source) return { id: source.id };
          return { label, value };
        }
      }
      const careerPage = jobSources.find((s) => s.value === "careerpage");
      return careerPage ? { id: careerPage.id } : undefined;
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

  const bulletsToHtml = (items: string[]): string => {
    const filtered = items.filter((i) => i.trim());
    return `<ul>${filtered.map((i) => `<li><p>${i}</p></li>`).join("")}</ul>`;
  };

  const fillFormFromExtraction = async (extracted: JobExtraction, sourceUrl?: string) => {
    const currentValues = form.getValues();

    // Job Title — exact match only; create new if not found
    if (!currentValues.title) {
      const normalized = extracted.title.trim().toLowerCase();
      const exactMatch = jobTitles.find((t) => t.value === normalized);
      if (exactMatch) {
        setValue("title", exactMatch.id);
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
        if (/ordinance|fair chance|eeoc|equal opportunity/i.test(loc)) continue;
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

    // Source (detect from URL, auto-create if missing)
    if (!currentValues.source) {
      const jobUrl = sourceUrl || currentValues.jobUrl;
      if (jobUrl) {
        const detected = detectSourceFromUrl(jobUrl);
        if (detected && "id" in detected) {
          setValue("source", detected.id);
        } else if (detected) {
          const created = await createJobSource(detected.label, detected.value);
          if (created?.id) {
            jobSources.push(created);
            setValue("source", created.id);
          }
        }
      }
    }

    // Job Type
    if (extracted.jobType) {
      setValue("type", extracted.jobType);
    }

    // Work Arrangement
    if (extracted.workArrangement) {
      setValue("workArrangement", extracted.workArrangement);
    }

    // Salary
    if (currentValues.salaryMin == null && extracted.salaryMin != null) {
      const snapped = snapToSalaryValue(extracted.salaryMin);
      if (snapped) setValue("salaryMin", snapped, { shouldValidate: true, shouldDirty: true });
    }
    if (currentValues.salaryMax == null && extracted.salaryMax != null) {
      const snapped = snapToSalaryValue(extracted.salaryMax);
      if (snapped) setValue("salaryMax", snapped, { shouldValidate: true, shouldDirty: true });
    }

    // Description
    if (!currentValues.jobDescription) {
      setValue("jobDescription", extracted.description);
      setEditorKey((k) => k + 1);
    }

    // Responsibilities
    if (!currentValues.responsibilities && extracted.responsibilities?.length) {
      setValue("responsibilities", bulletsToHtml(extracted.responsibilities));
      setEditorKey((k) => k + 1);
    }

    // Minimum Qualifications
    if (!currentValues.minimumQualifications && extracted.minimumQualifications?.length) {
      setValue("minimumQualifications", bulletsToHtml(extracted.minimumQualifications));
      setEditorKey((k) => k + 1);
    }

    // Preferred Qualifications
    if (!currentValues.preferredQualifications && extracted.preferredQualifications?.length) {
      setValue("preferredQualifications", bulletsToHtml(extracted.preferredQualifications));
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

  const processExtractResponse = async (res: Response, sourceUrl?: string) => {
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
    await fillFormFromExtraction(extracted, sourceUrl);
    setShowPasteInput(false);
    setPasteContent("");

    toast({
      variant: "success",
      description: "Form auto-filled from job posting.",
    });
  };

  const getPipelineSettings = () => {
    return getFromLocalStorage("pipelineSettings", defaultPipelineSettings);
  };

  const handleAutoFill = async (url: string) => {
    const selectedModel = getSelectedModel();
    if (!selectedModel) return;
    setIsExtracting(true);

    try {
      const pipelineSettings = getPipelineSettings();
      const res = await fetch("/api/ai/job/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, selectedModel, pipelineSettings }),
      });
      await processExtractResponse(res, url);
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
      const pipelineSettings = getPipelineSettings();
      const res = await fetch("/api/ai/job/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ htmlContent: pasteContent, selectedModel, pipelineSettings }),
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
