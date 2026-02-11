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
  WORK_ARRANGEMENTS,
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
import CreateResume from "../profile/CreateResume";
import { getResumeList } from "@/actions/profile.actions";
import { useJobExtraction } from "./useJobExtraction";

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
  const [editorKey, setEditorKey] = useState(0);
  const form = useForm<z.infer<typeof AddJobFormSchema>>({
    // Cast needed: Zod v4 .refine() wraps the schema type, making it incompatible
    // with @hookform/resolvers' expected z4.$ZodType<Output, Input> constraint.
    resolver: zodResolver(AddJobFormSchema) as any,
    defaultValues: {
      type: Object.keys(JOB_TYPES)[0],
      dueDate: addDays(new Date(), 3),
      status: jobStatuses[0].id,
      location: [],
    },
  });

  const {
    isExtracting,
    showPasteInput,
    setShowPasteInput,
    pasteContent,
    setPasteContent,
    handleAutoFill,
    handleAutoFillFromPaste,
  } = useJobExtraction({
    form,
    jobSources,
    jobTitles,
    companies,
    locations,
    setEditorKey,
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
          workArrangement: editJob.workArrangement ?? undefined,
          source: editJob.JobSource.id,
          status: editJob.Status.id,
          dueDate: editJob.dueDate,
          salaryMin: editJob.salaryMin ?? undefined,
          salaryMax: editJob.salaryMax ?? undefined,
          jobDescription: editJob.description,
          responsibilities: editJob.responsibilities ?? undefined,
          minimumQualifications: editJob.minimumQualifications ?? undefined,
          preferredQualifications: editJob.preferredQualifications ?? undefined,
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
                className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6"
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
                {/* Work Arrangement */}
                <div>
                  <FormField
                    control={form.control}
                    name="workArrangement"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="mb-2">Work Arrangement</FormLabel>
                        <RadioGroup
                          name="workArrangement"
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex space-y-1"
                        >
                          {Object.entries(WORK_ARRANGEMENTS).map(
                            ([key, value]) => (
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
                            )
                          )}
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
                          <TiptapEditor key={editorKey} field={field} ariaLabelledBy="job-description-label" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {/* Responsibilities */}
                <div className="md:col-span-2">
                  <FormField
                    control={form.control}
                    name="responsibilities"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel id="responsibilities-label">Responsibilities</FormLabel>
                        <FormControl>
                          <TiptapEditor key={editorKey} field={field} ariaLabelledBy="responsibilities-label" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {/* Minimum Qualifications */}
                <div className="md:col-span-2">
                  <FormField
                    control={form.control}
                    name="minimumQualifications"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel id="min-qualifications-label">Minimum Qualifications</FormLabel>
                        <FormControl>
                          <TiptapEditor key={editorKey} field={field} ariaLabelledBy="min-qualifications-label" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {/* Preferred Qualifications */}
                <div className="md:col-span-2">
                  <FormField
                    control={form.control}
                    name="preferredQualifications"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel id="preferred-qualifications-label">Preferred Qualifications</FormLabel>
                        <FormControl>
                          <TiptapEditor key={editorKey} field={field} ariaLabelledBy="preferred-qualifications-label" />
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
