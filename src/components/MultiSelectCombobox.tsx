"use client";

import { Check, ChevronsUpDown, CirclePlus, Loader, X } from "lucide-react";
import { ControllerRenderProps } from "react-hook-form";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { FormControl } from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import { useState, useTransition } from "react";
import { createLocation } from "@/actions/job.actions";
import { toast } from "./ui/use-toast";

interface MultiSelectComboboxProps {
  options: any[];
  field: ControllerRenderProps<any, any>;
  creatable?: boolean;
  placeholder?: string;
}

export function MultiSelectCombobox({
  options,
  field,
  creatable,
  placeholder,
}: MultiSelectComboboxProps) {
  const [newOption, setNewOption] = useState<string>("");
  const [isPopoverOpen, setIsPopoverOpen] = useState<boolean>(false);
  const [isPending, startTransition] = useTransition();

  const selectedValues: string[] = field.value || [];

  const onCreateOption = (label: string) => {
    if (!label) return;
    startTransition(async () => {
      const { data, success, message } = await createLocation(label);
      if (!success) {
        toast({
          variant: "destructive",
          title: "Error!",
          description: message,
        });
        return;
      }
      if (!data || !data.id) {
        toast({
          variant: "destructive",
          title: "Error!",
          description: "Failed to create option.",
        });
        return;
      }
      options.unshift(data);
      field.onChange([...selectedValues, data.id]);
      setNewOption("");
    });
  };

  const toggleOption = (optionId: string) => {
    const newValues = selectedValues.includes(optionId)
      ? selectedValues.filter((id: string) => id !== optionId)
      : [...selectedValues, optionId];
    field.onChange(newValues);
  };

  const removeOption = (optionId: string) => {
    field.onChange(selectedValues.filter((id: string) => id !== optionId));
  };

  const displayLabel =
    selectedValues.length > 0
      ? `${selectedValues.length} location${selectedValues.length > 1 ? "s" : ""} selected`
      : placeholder || `Select ${field.name}`;

  return (
    <div className="flex flex-col gap-2">
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <FormControl>
            <Button
              variant="outline"
              role="combobox"
              className={cn(
                "md:w-[240px] lg:w-[280px] justify-between",
                selectedValues.length === 0 && "text-muted-foreground"
              )}
            >
              {displayLabel}
              {isPending ? (
                <Loader className="h-4 w-4 shrink-0 spinner" />
              ) : (
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              )}
            </Button>
          </FormControl>
        </PopoverTrigger>
        <PopoverContent className="md:w-[240px] lg:w-[280px] p-0">
          <Command
            filter={(value, search) =>
              value.includes(search.toLowerCase()) ? 1 : 0
            }
          >
            <CommandInput
              value={newOption}
              onValueChange={(val: string) => setNewOption(val)}
              placeholder={`${creatable ? "Create or " : ""}Search location`}
            />
            <CommandEmpty
              onClick={() => {
                if (creatable) {
                  onCreateOption(newOption);
                  setNewOption("");
                }
              }}
              className={cn(
                "flex cursor-pointer items-center justify-center gap-1 italic mt-2",
                !newOption && "text-muted-foreground cursor-default"
              )}
            >
              {creatable ? (
                <>
                  <CirclePlus className="h-4 w-4" />
                  <p>Create: </p>
                  <p className="block max-w-48 truncate font-semibold text-primary">
                    {newOption}
                  </p>
                </>
              ) : (
                <p className="font-semibold text-primary">No options found!</p>
              )}
            </CommandEmpty>
            <ScrollArea>
              <CommandGroup>
                <CommandList className="capitalize">
                  {options.map((option) => {
                    const isSelected = selectedValues.includes(option.id);
                    return (
                      <CommandItem
                        value={option.value}
                        key={option.id}
                        onSelect={() => toggleOption(option.id)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            isSelected ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {option.label}
                      </CommandItem>
                    );
                  })}
                </CommandList>
              </CommandGroup>
            </ScrollArea>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedValues.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedValues.map((id: string) => {
            const option = options.find((opt: any) => opt.id === id);
            return option ? (
              <Badge
                key={id}
                variant="secondary"
                className="pl-2 pr-1 py-1 gap-1 capitalize"
              >
                {option.label}
                <button
                  type="button"
                  onClick={() => removeOption(id)}
                  className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}
