"use client";
import { useTransition, useState, useEffect } from "react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Check, Loader, Loader2, PlusCircle, Sparkles } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { AddCompanyFormSchema } from "@/models/addCompanyForm.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { toast } from "../ui/use-toast";
import { addCompany, updateCompany } from "@/actions/company.actions";
import { Company } from "@/models/job.model";
import { getFromLocalStorage } from "@/utils/localstorage.utils";
import { TipTapContentViewer } from "../TipTapContentViewer";

type AddCompanyProps = {
  reloadCompanies: () => void;
  editCompany?: Company | null;
  resetEditCompany: () => void;
  dialogOpen: boolean;
  setDialogOpen: (e: boolean) => void;
};

function AddCompany({
  reloadCompanies,
  editCompany,
  resetEditCompany,
  dialogOpen,
  setDialogOpen,
}: AddCompanyProps) {
  const [isPending, startTransition] = useTransition();
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [autoFillDone, setAutoFillDone] = useState(false);

  const pageTitle = editCompany ? "Edit Company" : "Add Company";

  const form = useForm<z.infer<typeof AddCompanyFormSchema>>({
    resolver: zodResolver(AddCompanyFormSchema),
    defaultValues: {
      company: "",
      careerPageUrl: "",
      logoUrl: "",
      description: "",
      id: undefined,
      createdBy: undefined,
    },
  });

  const { reset, formState } = form;

  useEffect(() => {
    if (editCompany) {
      reset(
        {
          id: editCompany?.id,
          company: editCompany?.label ?? "",
          createdBy: editCompany?.createdBy,
          careerPageUrl: editCompany?.careerPageUrl ?? "",
          logoUrl: editCompany?.logoUrl ?? "",
          description: editCompany?.description ?? "",
        },
        { keepDefaultValues: true },
      );
    }
  }, [editCompany, reset]);

  const addCompanyForm = () => {
    if (!editCompany) {
      reset();
      resetEditCompany();
    }
    setAutoFillDone(false);
    setDialogOpen(true);
  };

  const closeDialog = () => setDialogOpen(false);

  const handleAutoFill = async () => {
    const careerPageUrl = form.getValues("careerPageUrl");
    if (!careerPageUrl) {
      toast({
        variant: "destructive",
        title: "URL required",
        description: "Enter a career page URL first.",
      });
      return;
    }

    const selectedModel = getFromLocalStorage("aiSettings", null);
    if (!selectedModel) {
      toast({
        variant: "destructive",
        title: "No AI model configured",
        description: "Configure an AI model in Settings first.",
      });
      return;
    }

    setIsAutoFilling(true);
    setAutoFillDone(false);
    try {
      const res = await fetch("/api/ai/company/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: careerPageUrl, selectedModel }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast({
          variant: "destructive",
          title: "Auto-fill failed",
          description: err.error || "Could not scrape the career page.",
        });
        return;
      }

      const { name, logoUrl, description } = await res.json();

      if (name && !form.getValues("company")) {
        form.setValue("company", name, { shouldDirty: true });
      }
      if (logoUrl) {
        form.setValue("logoUrl", logoUrl, { shouldDirty: true });
      }
      if (description) {
        form.setValue("description", description, { shouldDirty: true });
      }

      setAutoFillDone(true);
      toast({
        variant: "success",
        description: "Auto-fill complete — name, favicon, and description extracted.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Auto-fill failed",
        description: "Network error. Check your connection.",
      });
    } finally {
      setIsAutoFilling(false);
    }
  };

  const onSubmit = (data: z.infer<typeof AddCompanyFormSchema>) => {
    startTransition(async () => {
      const res = editCompany
        ? await updateCompany(data)
        : await addCompany(data);
      if (!res?.success) {
        toast({
          variant: "destructive",
          title: "Error!",
          description: res?.message,
        });
      } else {
        reset();
        setAutoFillDone(false);
        setDialogOpen(false);
        reloadCompanies();
        toast({
          variant: "success",
          description: `Company has been ${
            editCompany ? "updated" : "created"
          } successfully`,
        });
      }
    });
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1"
        onClick={addCompanyForm}
        data-testid="add-company-btn"
      >
        <PlusCircle className="h-3.5 w-3.5" />
        <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
          Add Company
        </span>
      </Button>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="lg:max-h-screen overflow-y-scroll">
          <DialogHeader>
            <DialogTitle>{pageTitle}</DialogTitle>
            <DialogDescription className="text-primary">
              Caution: Editing name of the company will affect all the related
              job records.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="grid grid-cols-1 md:grid-cols-2 gap-4 p-2"
            >
              {/* CAREER PAGE URL */}
              <div className="md:col-span-2">
                <FormField
                  control={form.control}
                  name="careerPageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Career Page URL</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input
                            placeholder="https://company.com/careers"
                            {...field}
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0 gap-1"
                          onClick={handleAutoFill}
                          disabled={isAutoFilling}
                        >
                          {isAutoFilling ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : autoFillDone ? (
                            <Check className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5" />
                          )}
                          Auto-fill
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* COMPANY NAME */}
              <div className="md:col-span-2">
                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* COMPANY DESCRIPTION (read-only preview) */}
              {form.watch("description") && (
                <div className="md:col-span-2">
                  <FormLabel>Company Description</FormLabel>
                  <div className="mt-1.5 rounded-md border p-3 text-sm text-muted-foreground">
                    <TipTapContentViewer content={form.watch("description")!} />
                  </div>
                </div>
              )}

              <div className="md:col-span-2 mt-4">
                <DialogFooter>
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
                  <Button type="submit" disabled={!formState.isDirty}>
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
      </Dialog>
    </>
  );
}

export default AddCompany;
