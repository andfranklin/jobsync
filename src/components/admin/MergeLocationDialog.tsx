"use client";
import { useEffect, useState, useTransition } from "react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Check, ChevronsUpDown, Loader } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";
import { ScrollArea } from "../ui/scroll-area";
import { toast } from "../ui/use-toast";
import {
  getLocationDependencies,
  mergeJobLocations,
} from "@/actions/jobLocation.actions";
import { JobLocation } from "@/models/job.model";

type MergeLocationDialogProps = {
  sourceLocation: JobLocation | null;
  allLocations: JobLocation[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMergeComplete: () => void;
};

function MergeLocationDialog({
  sourceLocation,
  allLocations,
  open,
  onOpenChange,
  onMergeComplete,
}: MergeLocationDialogProps) {
  const [targetId, setTargetId] = useState<string>("");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [deps, setDeps] = useState<{
    jobCount: number;
    workExpCount: number;
    educationCount: number;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open && sourceLocation) {
      setTargetId("");
      setDeps(null);
      getLocationDependencies(sourceLocation.id).then((res) => {
        if (res?.success) {
          setDeps({
            jobCount: res.jobCount,
            workExpCount: res.workExpCount,
            educationCount: res.educationCount,
          });
        }
      });
    }
  }, [open, sourceLocation]);

  const availableTargets = allLocations.filter(
    (loc) => loc.id !== sourceLocation?.id
  );

  const selectedTarget = availableTargets.find((loc) => loc.id === targetId);

  const onConfirmMerge = () => {
    if (!sourceLocation || !targetId) return;
    startTransition(async () => {
      const res = await mergeJobLocations(sourceLocation.id, targetId);
      if (res?.success) {
        onOpenChange(false);
        onMergeComplete();
        toast({
          variant: "success",
          description: `"${sourceLocation.label}" has been merged into "${selectedTarget?.label}"`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error!",
          description: res?.message,
        });
      }
    });
  };

  const totalDeps =
    deps ? deps.jobCount + deps.workExpCount + deps.educationCount : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="lg:max-h-screen overflow-y-scroll">
        <DialogHeader>
          <DialogTitle>Merge Location</DialogTitle>
          <DialogDescription className="text-primary">
            Reassign all relationships from{" "}
            <strong>{sourceLocation?.label}</strong> to the selected target,
            then delete <strong>{sourceLocation?.label}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 p-2">
          {/* Dependency summary */}
          {deps && (
            <div className="rounded-md border p-3 text-sm space-y-1">
              <p className="font-medium">Records to reassign:</p>
              <ul className="list-disc list-inside text-muted-foreground">
                <li>{deps.jobCount} job(s)</li>
                <li>{deps.workExpCount} work experience(s)</li>
                <li>{deps.educationCount} education record(s)</li>
              </ul>
            </div>
          )}

          {/* Target selector */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Merge into:
            </label>
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className={cn(
                    "w-full justify-between capitalize",
                    !targetId && "text-muted-foreground"
                  )}
                >
                  {selectedTarget?.label ?? "Select target location"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command
                  filter={(value, search) =>
                    value.includes(search.toLowerCase()) ? 1 : 0
                  }
                >
                  <CommandInput placeholder="Search locations..." />
                  <CommandEmpty>No locations found.</CommandEmpty>
                  <ScrollArea>
                    <CommandGroup>
                      <CommandList className="capitalize">
                        {availableTargets.map((loc) => (
                          <CommandItem
                            value={loc.value}
                            key={loc.id}
                            onSelect={() => {
                              setTargetId(loc.id);
                              setPopoverOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                loc.id === targetId
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            {loc.label}
                          </CommandItem>
                        ))}
                      </CommandList>
                    </CommandGroup>
                  </ScrollArea>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!targetId || isPending || totalDeps === 0}
            onClick={onConfirmMerge}
          >
            Merge
            {isPending && <Loader className="h-4 w-4 shrink-0 spinner" />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default MergeLocationDialog;
