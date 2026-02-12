"use client";
import { format } from "date-fns";
import { Badge } from "../ui/badge";
import { cn, formatUrl } from "@/lib/utils";
import { JobResponse, WORK_ARRANGEMENTS } from "@/models/job.model";
import { TipTapContentViewer } from "../TipTapContentViewer";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { ArrowLeft, Sparkles, RotateCcw, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { AiJobMatchSection } from "../profile/AiJobMatchSection";
import { useEffect, useState } from "react";
import { DownloadFileButton } from "../profile/DownloadFileButton";
import { getJobPipelineInfo } from "@/actions/job.actions";
import { getFromLocalStorage } from "@/utils/localstorage.utils";
import { defaultPipelineSettings } from "@/models/pipeline.model";
import { toast } from "../ui/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

function JobDetails({ job }: { job: JobResponse }) {
  const [aiSectionOpen, setAiSectionOpen] = useState(false);
  const [hasPipelineData, setHasPipelineData] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [pipelineInfo, setPipelineInfo] = useState<{
    configHash: string;
    processedAt: Date;
    configChanged: boolean;
  } | null>(null);
  const router = useRouter();
  const goBack = () => router.back();
  const getAiJobMatch = async () => {
    setAiSectionOpen(true);
  };

  useEffect(() => {
    if (job?.id) {
      const aiSettings = getFromLocalStorage("aiSettings", null) as {
        provider: string;
        model: string;
        numCtx?: number;
      } | null;
      const pipelineSettings = getFromLocalStorage(
        "pipelineSettings",
        defaultPipelineSettings,
      );
      const currentSettings = aiSettings
        ? {
            provider: aiSettings.provider,
            model: aiSettings.model || "llama3.2",
            numCtx: aiSettings.numCtx,
            cleaningMethod: pipelineSettings.cleaningMethod,
          }
        : undefined;

      getJobPipelineInfo(job.id, currentSettings).then((result) => {
        if (result.success && result.hasPipelineData) {
          setHasPipelineData(true);
          if ("configHash" in result) {
            setPipelineInfo({
              configHash: result.configHash,
              processedAt: result.processedAt,
              configChanged: result.configChanged,
            });
          }
        }
      });
    }
  }, [job?.id]);

  const handleReprocess = async () => {
    const selectedModel = getFromLocalStorage("aiSettings", null);
    if (!selectedModel) {
      toast({
        variant: "destructive",
        title: "No AI model configured",
        description: "Configure an AI model in Settings first.",
      });
      return;
    }

    setIsReprocessing(true);
    try {
      const pipelineSettings = getFromLocalStorage(
        "pipelineSettings",
        defaultPipelineSettings,
      );
      const res = await fetch("/api/ai/job/reprocess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, selectedModel, pipelineSettings }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast({
          variant: "destructive",
          title: "Re-process failed",
          description: err.error || "An error occurred.",
        });
        return;
      }

      const extracted = await res.json();
      const updatedFields: string[] = [];
      if (extracted.title) updatedFields.push("title");
      if (extracted.company) updatedFields.push("company");
      if (extracted.description) updatedFields.push("description");
      if (extracted.locations?.length) updatedFields.push("locations");

      toast({
        variant: "success",
        description: `Re-processed successfully. Updated: ${updatedFields.join(", ") || "extraction complete"}.`,
      });
      router.refresh();
    } catch {
      toast({
        variant: "destructive",
        title: "Re-process failed",
        description: "Network error. Check your connection.",
      });
    } finally {
      setIsReprocessing(false);
    }
  };
  const getJobType = (code: string) => {
    switch (code) {
      case "FT":
        return "Full-time";
      case "PT":
        return "Part-time";
      case "C":
        return "Contract";
      default:
        return "Unknown";
    }
  };
  return (
    <>
      <div className="flex justify-between">
        <Button title="Go Back" size="sm" variant="outline" onClick={goBack}>
          <ArrowLeft />
        </Button>
        <div className="flex gap-2">
          {hasPipelineData && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 cursor-pointer relative"
                    onClick={handleReprocess}
                    disabled={isReprocessing}
                  >
                    {isReprocessing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5" />
                    )}
                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                      Re-process
                    </span>
                    {pipelineInfo?.configChanged && (
                      <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-orange-500" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {pipelineInfo?.configChanged
                    ? "Pipeline settings have changed — re-process to update"
                    : "Re-process with current pipeline settings"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 cursor-pointer"
            onClick={getAiJobMatch}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
              Match with AI
            </span>
          </Button>
        </div>
      </div>
      {job?.id && (
        <Card className="col-span-3">
          <CardHeader className="flex-row justify-between relative">
            <div>
              {job?.Company?.label}
              <CardTitle>{job?.JobTitle?.label}</CardTitle>
              <CardDescription>
                {job?.Locations && job.Locations.length > 0
                  ? job.Locations.map((l: any) => l.label).join(", ")
                  : "No location"}{" "}
                - {getJobType(job?.jobType)}
                {job?.workArrangement && (
                  <>
                    {" "}
                    · {WORK_ARRANGEMENTS[job.workArrangement as keyof typeof WORK_ARRANGEMENTS] ?? job.workArrangement}
                  </>
                )}
              </CardDescription>
            </div>
            <div>
              {job?.Resume && job?.Resume?.File && job.Resume?.File?.filePath
                ? DownloadFileButton(
                    job?.Resume?.File?.filePath,
                    job?.Resume?.title,
                    job?.Resume?.File?.fileName
                  )
                : null}
            </div>
          </CardHeader>
          <h3 className="ml-4">
            {new Date() > job.dueDate && job.Status?.value === "draft" ? (
              <Badge className="bg-red-500">Expired</Badge>
            ) : (
              <Badge
                className={cn(
                  "w-[70px] justify-center",
                  job.Status?.value === "applied" && "bg-cyan-500",
                  job.Status?.value === "interview" && "bg-green-500"
                )}
              >
                {job.Status?.label}
              </Badge>
            )}
            <span className="ml-2">
              {job?.appliedDate ? format(new Date(job?.appliedDate), "PP") : ""}
            </span>
          </h3>
          {job.jobUrl && (
            <div className="my-3 ml-4">
              <span className="font-semibold mr-2">Job URL:</span>
              <a
                href={formatUrl(job.jobUrl)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {job.jobUrl}
              </a>
            </div>
          )}
          {job?.Company?.description && (
            <div className="my-4 ml-4">
              <h3 className="font-semibold mb-2">About the Company</h3>
              <TipTapContentViewer content={job.Company.description} />
            </div>
          )}
          <div className="my-4 ml-4">
            <TipTapContentViewer content={job?.description} />
          </div>
          {job.responsibilities && (
            <div className="my-4 ml-4">
              <h3 className="font-semibold mb-2">Responsibilities</h3>
              <TipTapContentViewer content={job.responsibilities} />
            </div>
          )}
          {job.minimumQualifications && (
            <div className="my-4 ml-4">
              <h3 className="font-semibold mb-2">Minimum Qualifications</h3>
              <TipTapContentViewer content={job.minimumQualifications} />
            </div>
          )}
          {job.preferredQualifications && (
            <div className="my-4 ml-4">
              <h3 className="font-semibold mb-2">Preferred Qualifications</h3>
              <TipTapContentViewer content={job.preferredQualifications} />
            </div>
          )}
          <CardFooter>
            {pipelineInfo && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">Pipeline: {pipelineInfo.configHash}</span>
                <span>·</span>
                <span>
                  Processed {format(new Date(pipelineInfo.processedAt), "PP")}
                </span>
                {pipelineInfo.configChanged && (
                  <>
                    <span>·</span>
                    <span className="text-orange-500 font-medium">
                      Settings changed
                    </span>
                  </>
                )}
              </div>
            )}
          </CardFooter>
        </Card>
      )}
      {
        <AiJobMatchSection
          jobId={job?.id}
          aISectionOpen={aiSectionOpen}
          triggerChange={setAiSectionOpen}
        />
      }
    </>
  );
}

export default JobDetails;
