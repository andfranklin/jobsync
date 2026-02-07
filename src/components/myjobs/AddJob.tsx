"use client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { addJob, updateJob } from "@/actions/job.actions";
import { ClipboardPaste, Loader, PlusCircle, Sparkles } from "lucide-react";
import { Button } from "../ui/button";
import { useForm } from "react-hook-form";
import { useCallback, useEffect, useState, useTransition } from "react";
import { AddJobFormSchema } from "@/models/addJobForm.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Company,
  JOB_TYPES,
  JobLocation,
  JobResponse,
  JobSource,
  JobStatus,
  JobTitle,
} from "@/models/job.model";
import { addDays } from "date-fns";
import { z } from "zod";
import { toast } from "../ui/use-toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import SelectFormCtrl from "../Select";
import { DatePicker } from "../DatePicker";
import { SALARY_VALUES } from "@/lib/data/salaryRangeData";
import { createLocation } from "@/actions/job.actions";
import { addCompany } from "@/actions/company.actions";
import { createJobTitle } from "@/actions/jobtitle.actions";
import { JobExtraction } from "@/models/jobExtraction.schema";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import TiptapEditor from "../TiptapEditor";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Switch } from "../ui/switch";
import { redirect } from "next/navigation";
import { Combobox } from "../ComboBox";
import { MultiSelectCombobox } from "../MultiSelectCombobox";
import { Resume } from "@/models/profile.model";
import { getFromLocalStorage } from "@/utils/localstorage.utils";
import CreateResume from "../profile/CreateResume";
import { getResumeList } from "@/actions/profile.actions";

type AddJobProps = {
  jobStatuses: JobStatus[];
  companies: Company[];
  jobTitles: JobTitle[];
  locations: JobLocation[];
  jobSources: JobSource[];
  editJob?: JobResponse | null;
  resetEditJob: () => void;
};

export function AddJob({
  jobStatuses,
  companies,
  jobTitles,
  locations,
  jobSources,
  editJob,
  resetEditJob,
}: AddJobProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [resumeDialogOpen, setResumeDialogOpen] = useState(false);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [isPending, startTransition] = useTransition();
  const [isExtracting, setIsExtracting] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [showPasteInput, setShowPasteInput] = useState(false);
  const [pasteContent, setPasteContent] = useState("");
  const form = useForm<z.infer<typeof AddJobFormSchema>>({
    resolver: zodResolver(AddJobFormSchema) as any,
    defaultValues: {
      type: Object.keys(JOB_TYPES)[0],
      dueDate: addDays(new Date(), 3),
      status: jobStatuses[0].id,
      location: [],
    },
  });

  const { setValue, reset, watch, resetField } = form;

  const appliedValue = watch("applied");
  const salaryMinValue = watch("salaryMin");

  useEffect(() => {
    const currentMax = form.getValues("salaryMax");
    if (
      typeof salaryMinValue === "number" &&
      typeof currentMax === "number" &&
      currentMax < salaryMinValue
    ) {
      setValue("salaryMax", undefined);
    }
  }, [salaryMinValue, setValue, form]);

  const loadResumes = useCallback(async () => {
    try {
      const resumes = await getResumeList();
      setResumes(resumes.data);
    } catch (error) {
      console.error("Failed to load resumes:", error);
    }
  }, [setResumes]);

  useEffect(() => {
    if (editJob) {
      reset(
        {
          id: editJob.id,
          userId: editJob.userId,
          title: editJob.JobTitle.id,
          company: editJob.Company.id,
          location: editJob.Locations?.map((l) => l.id) ?? [],
          type: editJob.jobType,
          source: editJob.JobSource.id,
          status: editJob.Status.id,
          dueDate: editJob.dueDate,
          salaryMin: editJob.salaryMin ?? undefined,
          salaryMax: editJob.salaryMax ?? undefined,
          jobDescription: editJob.description,
          applied: editJob.applied,
          jobUrl: editJob.jobUrl ?? undefined,
          dateApplied: editJob.appliedDate ?? undefined,
          resume: editJob.Resume?.id ?? undefined,
        },
        { keepDefaultValues: true }
      );
      setDialogOpen(true);
    }
  }, [editJob, reset]);

  useEffect(() => {
    loadResumes();
  }, [loadResumes]);

  const setNewResumeId = (id: string) => {
    setTimeout(() => {
      setValue("resume", id);
    }, 500);
  };

  function onSubmit(data: z.infer<typeof AddJobFormSchema>) {
    startTransition(async () => {
      const { success, message } = editJob
        ? await updateJob(data)
        : await addJob(data);
      reset();
      setDialogOpen(false);
      if (!success) {
        toast({
          variant: "destructive",
          title: "Error!",
          description: message,
        });
      }
      redirect("/dashboard/myjobs");
    });
    toast({
      variant: "success",
      description: `Job has been ${
        editJob ? "updated" : "created"
      } successfully`,
    });
  }

  const pageTitle = editJob ? "Edit Job" : "Add Job";

  const addJobForm = () => {
    reset();
    resetEditJob();
    setDialogOpen(true);
  };

  const jobAppliedChange = (applied: boolean) => {
    if (applied) {
      form.getValues("status") === jobStatuses[0].id &&
        setValue("status", jobStatuses[1].id);
      setValue("dateApplied", new Date());
    } else {
      resetField("dateApplied");
      setValue("status", jobStatuses[0].id);
    }
  };

  const closeDialog = () => setDialogOpen(false);

  const createResume = () => {
    setResumeDialogOpen(true);
  };

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
      // If no known job board, assume it's a company career page
      return jobSources.find((s) => s.value === "careerpage")?.id;
    } catch {
      return undefined;
    }
  };

  const snapToSalaryValue = (amount: number): number | undefined => {
    if (amount < 50000) return undefined;
    const snapped =
      SALARY_VALUES.reduce((prev, curr) =>
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
      // Show paste fallback on 422 errors (site blocked, not enough text, etc.)
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

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1"
        onClick={addJobForm}
        data-testid="add-job-btn"
      >
        <PlusCircle className="h-3.5 w-3.5" />
        <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
          Add Job
        </span>
      </Button>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogOverlay>
          <DialogContent className="h-full xl:h-[85vh] lg:h-[95vh] lg:max-w-screen-lg lg:max-h-screen overflow-y-scroll">
            <DialogHeader>
              <DialogTitle data-testid="add-job-dialog-title">
                {pageTitle}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4"
              >
                {/* Job URL */}
                <div className="md:col-span-2">
                  <FormField
                    control={form.control}
                    name="jobUrl"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Job URL</FormLabel>
                        <div className="flex gap-2">
                          <FormControl>
                            <Input
                              placeholder="Copy and paste job link here"
                              {...field}
                            />
                          </FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            disabled={!field.value || isExtracting}
                            onClick={() => handleAutoFill(field.value!)}
                          >
                            {isExtracting ? (
                              <Loader className="h-4 w-4 shrink-0 spinner mr-1" />
                            ) : (
                              <Sparkles className="h-4 w-4 mr-1" />
                            )}
                            Auto-fill
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground mt-1"
                    onClick={() => setShowPasteInput(!showPasteInput)}
                  >
                    {showPasteInput
                      ? "Hide paste input"
                      : "Or paste job description"}
                  </button>
                  {showPasteInput && (
                    <div className="mt-2 space-y-2">
                      <Textarea
                        placeholder="Paste the job description text from the webpage here..."
                        value={pasteContent}
                        onChange={(e) => setPasteContent(e.target.value)}
                        rows={4}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pasteContent.length < 100 || isExtracting}
                        onClick={handleAutoFillFromPaste}
                      >
                        {isExtracting ? (
                          <Loader className="h-4 w-4 shrink-0 spinner mr-1" />
                        ) : (
                          <ClipboardPaste className="h-4 w-4 mr-1" />
                        )}
                        Extract from pasted text
                      </Button>
                    </div>
                  )}
                </div>

                {/* Job Title */}
                <div>
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Job Title</FormLabel>
                        <FormControl>
                          <Combobox
                            options={jobTitles}
                            field={field}
                            creatable
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {/* Company */}
                <div>
                  <FormField
                    control={form.control}
                    name="company"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Company</FormLabel>
                        <FormControl>
                          <Combobox
                            options={companies}
                            field={field}
                            creatable
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {/* Location(s) */}
                <div>
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Job Location(s)</FormLabel>
                        <FormControl>
                          <MultiSelectCombobox
                            options={locations}
                            field={field}
                            creatable
                            placeholder="Select locations"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {/* Job Type */}
                <div>
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="mb-2">Job Type</FormLabel>
                        <RadioGroup
                          name="type"
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex space-y-1"
                        >
                          {Object.entries(JOB_TYPES).map(([key, value]) => (
                            <FormItem
                              key={key}
                              className="flex items-center space-x-3 space-y-0"
                            >
                              <FormControl>
                                <RadioGroupItem value={key} />
                              </FormControl>
                              <FormLabel className="font-normal">
                                {value}
                              </FormLabel>
                            </FormItem>
                          ))}
                        </RadioGroup>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {/* Job Source */}
                <div>
                  <FormField
                    control={form.control}
                    name="source"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Job Source</FormLabel>
                        <Combobox options={jobSources} field={field} />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Applied */}
                <div
                  className="flex items-center"
                  data-testid="switch-container"
                >
                  <FormField
                    control={form.control}
                    name="applied"
                    render={({ field }) => (
                      <FormItem className="flex flex-row">
                        <Switch
                          id="applied-switch"
                          checked={field.value}
                          onCheckedChange={(a) => {
                            field.onChange(a);
                            jobAppliedChange(a);
                          }}
                        />
                        <FormLabel
                          htmlFor="applied-switch"
                          className="flex items-center ml-4 mb-2"
                        >
                          {field.value ? "Applied" : "Not Applied"}
                        </FormLabel>

                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Status */}
                <div>
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem className="flex flex-col [&>button]:capitalize">
                        <FormLabel>Status</FormLabel>
                        <SelectFormCtrl
                          label="Job Status"
                          options={jobStatuses}
                          field={field}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Date Applied */}
                <div className="flex flex-col">
                  <FormField
                    control={form.control}
                    name="dateApplied"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Date Applied</FormLabel>
                        <DatePicker
                          field={field}
                          presets={false}
                          isEnabled={appliedValue}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Due Date */}
                <div>
                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Due Date</FormLabel>
                        <DatePicker
                          field={field}
                          presets={true}
                          isEnabled={true}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Salary Range */}
                <div>
                  <FormLabel>Salary Range</FormLabel>
                  <div className="flex gap-2 mt-2">
                    <FormField
                      control={form.control}
                      name="salaryMin"
                      render={({ field }) => (
                        <FormItem className="flex flex-col flex-1">
                          <Select
                            onValueChange={(val) =>
                              field.onChange(val === "none" ? "" : Number(val))
                            }
                            value={field.value?.toString() ?? "none"}
                          >
                            <FormControl>
                              <SelectTrigger aria-label="Salary Min">
                                <SelectValue placeholder="No minimum" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectGroup>
                                <SelectItem value="none">No minimum</SelectItem>
                                {SALARY_VALUES.map((opt) => (
                                  <SelectItem
                                    key={opt.value}
                                    value={opt.value.toString()}
                                  >
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <span className="self-center text-muted-foreground">—</span>
                    <FormField
                      control={form.control}
                      name="salaryMax"
                      render={({ field }) => {
                        const minVal = form.watch("salaryMin");
                        const filteredOptions =
                          typeof minVal === "number"
                            ? SALARY_VALUES.filter((opt) => opt.value >= minVal)
                            : SALARY_VALUES;
                        return (
                          <FormItem className="flex flex-col flex-1">
                            <Select
                              onValueChange={(val) =>
                                field.onChange(
                                  val === "none" ? "" : Number(val),
                                )
                              }
                              value={field.value?.toString() ?? "none"}
                            >
                              <FormControl>
                                <SelectTrigger aria-label="Salary Max">
                                  <SelectValue placeholder="No maximum" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectGroup>
                                  <SelectItem value="none">
                                    No maximum
                                  </SelectItem>
                                  {filteredOptions.map((opt) => (
                                    <SelectItem
                                      key={opt.value}
                                      value={opt.value.toString()}
                                    >
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                  </div>
                </div>

                {/* Resume */}
                <div className="flex items-end">
                  <FormField
                    control={form.control}
                    name="resume"
                    render={({ field }) => (
                      <FormItem className="flex flex-col [&>button]:capitalize">
                        <FormLabel>Resume</FormLabel>
                        <SelectFormCtrl
                          label="Resume"
                          options={resumes}
                          field={field}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button variant="link" type="button" onClick={createResume}>
                    Add New
                  </Button>
                  <CreateResume
                    resumeDialogOpen={resumeDialogOpen}
                    setResumeDialogOpen={setResumeDialogOpen}
                    reloadResumes={loadResumes}
                    setNewResumeId={setNewResumeId}
                  />
                </div>

                {/* Job Description */}
                <div className="md:col-span-2">
                  <FormField
                    control={form.control}
                    name="jobDescription"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel id="job-description-label">
                          Job Description
                        </FormLabel>
                        <FormControl>
                          <TiptapEditor key={editorKey} field={field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="md:col-span-2">
                  <DialogFooter
                  // className="md:col-span
                  >
                    <div>
                      <Button
                        type="reset"
                        variant="outline"
                        className="mt-2 md:mt-0 w-full"
                        onClick={closeDialog}
                      >
                        Cancel
                      </Button>
                    </div>
                    <Button type="submit" data-testid="save-job-btn">
                      Save
                      {isPending && (
                        <Loader className="h-4 w-4 shrink-0 spinner" />
                      )}
                    </Button>
                  </DialogFooter>
                </div>
              </form>
            </Form>
          </DialogContent>
        </DialogOverlay>
      </Dialog>
    </>
  );
}
