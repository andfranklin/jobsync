"use client";
import { useState } from "react";
import { Company } from "@/models/job.model";
import { TipTapContentViewer } from "../TipTapContentViewer";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { ArrowLeft, Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatUrl } from "@/lib/utils";
import { toast } from "../ui/use-toast";
import { getFromLocalStorage } from "@/utils/localstorage.utils";

function CompanyDetails({ company }: { company: Company }) {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [description, setDescription] = useState(company?.description || "");
  const router = useRouter();

  const goBack = () => router.push("/dashboard/admin?tab=companies");

  const handleRegenerate = async () => {
    const selectedModel = getFromLocalStorage("aiSettings", null);
    if (!selectedModel) {
      toast({
        variant: "destructive",
        title: "No AI model configured",
        description: "Configure an AI model in Settings first.",
      });
      return;
    }

    setIsRegenerating(true);
    try {
      const res = await fetch("/api/ai/company/describe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: company.id, selectedModel }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast({
          variant: "destructive",
          title: "Regeneration failed",
          description: err.error || "An error occurred.",
        });
        return;
      }

      const { description: newDescription } = await res.json();
      setDescription(newDescription);
      toast({
        variant: "success",
        description: "Company description regenerated successfully.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Regeneration failed",
        description: "Network error. Check your connection.",
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <>
      <div className="flex justify-between">
        <Button title="Go Back" size="sm" variant="outline" onClick={goBack}>
          <ArrowLeft />
        </Button>
        {company?.careerPageUrl && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 cursor-pointer"
            onClick={handleRegenerate}
            disabled={isRegenerating}
          >
            {isRegenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" />
            )}
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
              {description ? "Regenerate Description" : "Generate Description"}
            </span>
          </Button>
        )}
      </div>
      {company?.id && (
        <Card className="col-span-3 mt-4">
          <CardHeader className="flex-row justify-between relative">
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="Company logo"
                className="w-12 h-12 rounded-md object-cover"
                src={company.logoUrl || "/images/jobsync-logo.svg"}
              />
              <div>
                <CardTitle>{company.label}</CardTitle>
                {company.careerPageUrl && (
                  <CardDescription>
                    <a
                      href={formatUrl(company.careerPageUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      {company.careerPageUrl}
                    </a>
                  </CardDescription>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {description ? (
              <div className="my-2">
                <h3 className="font-semibold mb-2">About</h3>
                <TipTapContentViewer content={description} />
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                {company.careerPageUrl
                  ? "No description yet. Click \"Generate Description\" to create one from the career page."
                  : "No description available. Add a career page URL via the edit dialog to enable AI description generation."}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

export default CompanyDetails;
