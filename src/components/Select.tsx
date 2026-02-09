import React from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { FormControl } from "./ui/form";
import { ControllerRenderProps } from "react-hook-form";

interface SelectOption {
  id: string;
  label?: string;
  value?: string;
  title?: string;
  [key: string]: unknown;
}

interface SelectProps {
  label: string;
  options: SelectOption[];
  field: ControllerRenderProps<any, any>;
}

function SelectFormCtrl({ label, options, field }: SelectProps) {
  return (
    <>
      <Select
        onValueChange={field.onChange}
        value={field.value}
        name={field.name}
      >
        <FormControl>
          <SelectTrigger aria-label={`Select ${label}`} className="w-[200px]">
            <SelectValue placeholder={`Select ${label}`} />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          <SelectGroup>
            {options &&
              options.map((option) => {
                return (
                  <SelectItem
                    key={option.id}
                    value={option.id}
                    className="capitalize"
                  >
                    {option.label ?? option.value ?? option.title}
                  </SelectItem>
                );
              })}
          </SelectGroup>
        </SelectContent>
      </Select>
    </>
  );
}

export default SelectFormCtrl;
