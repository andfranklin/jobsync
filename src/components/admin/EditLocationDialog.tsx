"use client";
import { useTransition, useEffect } from "react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Loader } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { EditLocationFormSchema } from "@/models/editLocationForm.schema";
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
import { updateJobLocation } from "@/actions/jobLocation.actions";
import { JobLocation } from "@/models/job.model";

type EditLocationDialogProps = {
  editLocation?: JobLocation | null;
  reloadLocations: () => void;
  resetEditLocation: () => void;
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
};

function EditLocationDialog({
  editLocation,
  reloadLocations,
  resetEditLocation,
  dialogOpen,
  setDialogOpen,
}: EditLocationDialogProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<z.infer<typeof EditLocationFormSchema>>({
    resolver: zodResolver(EditLocationFormSchema),
    defaultValues: {
      label: "",
      id: undefined,
      createdBy: undefined,
    },
  });

  const { reset, formState } = form;

  useEffect(() => {
    if (editLocation) {
      reset(
        {
          id: editLocation.id,
          label: editLocation.label ?? "",
          createdBy: editLocation.createdBy,
        },
        { keepDefaultValues: true }
      );
    }
  }, [editLocation, reset]);

  const closeDialog = () => {
    setDialogOpen(false);
    resetEditLocation();
  };

  const onSubmit = (data: z.infer<typeof EditLocationFormSchema>) => {
    startTransition(async () => {
      const res = await updateJobLocation(data);
      if (!res?.success) {
        toast({
          variant: "destructive",
          title: "Error!",
          description: res?.message,
        });
      } else {
        reset();
        setDialogOpen(false);
        resetEditLocation();
        reloadLocations();
        toast({
          variant: "success",
          description: "Location has been updated successfully",
        });
      }
    });
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="lg:max-h-screen overflow-y-scroll">
        <DialogHeader>
          <DialogTitle>Edit Location</DialogTitle>
          <DialogDescription className="text-primary">
            Caution: Editing the location name will affect all related job
            records.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid grid-cols-1 md:grid-cols-2 gap-4 p-2"
          >
            <div className="md:col-span-2">
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
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
  );
}

export default EditLocationDialog;
