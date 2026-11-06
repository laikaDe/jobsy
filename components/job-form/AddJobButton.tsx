"use client";

import { PlusIcon } from "lucide-react";
import { useState, type ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import type { Status } from "@/lib/status";
import { JobFormDialog } from "./JobFormDialog";

type Props = {
  companies: string[];
  defaultStatus?: Status;
  label?: string;
} & Pick<ComponentProps<typeof Button>, "variant" | "size" | "className">;

export function AddJobButton({ companies, defaultStatus, label = "Add job", ...buttonProps }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button {...buttonProps} onClick={() => setOpen(true)}>
        <PlusIcon />
        {label}
      </Button>
      <JobFormDialog open={open} onOpenChange={setOpen} defaultStatus={defaultStatus} companies={companies} />
    </>
  );
}
