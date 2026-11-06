"use client";

import { useActionState, useEffect, useId, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { deleteJob, saveJob, type SaveJobState } from "@/app/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { STATUS_LABELS, STATUSES, type Status } from "@/lib/status";
import type { JobDTO } from "@/lib/types";
import { parseJobInput, type JobFieldErrors } from "@/lib/validation";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present → edit mode */
  job?: JobDTO | null;
  defaultStatus?: Status;
  companies: string[];
};

export function JobFormDialog({ open, onOpenChange, job, defaultStatus = "WISHLIST", companies }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {/* Remount the form each time the dialog opens so fields and errors start fresh. */}
        {open && (
          <JobForm
            key={job?.id ?? `new-${defaultStatus}`}
            job={job ?? null}
            defaultStatus={defaultStatus}
            companies={companies}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function JobForm({
  job,
  defaultStatus,
  companies,
  onDone,
}: {
  job: JobDTO | null;
  defaultStatus: Status;
  companies: string[];
  onDone: () => void;
}) {
  const ids = useId();
  const [state, formAction, isSaving] = useActionState<SaveJobState, FormData>(saveJob, null);
  const [clientErrors, setClientErrors] = useState<JobFieldErrors | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (state?.ok) {
      toast.success(job ? "Job updated" : "Job added");
      onDone();
    } else if (state && !state.ok && state.formError) {
      toast.error(state.formError);
    }
  }, [state, job, onDone]);

  // Validate on the client first; onSubmit (not the `action` prop) so React doesn't reset the fields on error.
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = parseJobInput(fd);
    if (!parsed.ok) {
      setClientErrors(parsed.fieldErrors);
      return;
    }
    setClientErrors(null);
    startTransition(() => formAction(fd));
  }

  const errors: JobFieldErrors = clientErrors ?? (state && !state.ok ? state.fieldErrors : {});
  const field = (name: keyof JobFieldErrors) => ({
    id: `${ids}-${name}`,
    name,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${ids}-${name}-error` : undefined,
  });
  const error = (name: keyof JobFieldErrors) =>
    errors[name] ? (
      <p id={`${ids}-${name}-error`} className="text-destructive text-sm">
        {errors[name]}
      </p>
    ) : null;

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{job ? "Edit job" : "Add job"}</DialogTitle>
        <DialogDescription>{job ? `${job.companyName} · ${job.title}` : "Track a new application."}</DialogDescription>
      </DialogHeader>

      {job && <input type="hidden" name="id" value={job.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`${ids}-company`}>Company *</Label>
          <Input {...field("company")} list={`${ids}-companies`} defaultValue={job?.companyName} autoComplete="off" autoFocus />
          <datalist id={`${ids}-companies`}>
            {companies.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          {error("company")}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${ids}-title`}>Title *</Label>
          <Input {...field("title")} defaultValue={job?.title} />
          {error("title")}
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor={`${ids}-url`}>URL</Label>
        <Input {...field("url")} type="url" placeholder="https://" defaultValue={job?.url ?? ""} />
        {error("url")}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`${ids}-status`}>Status</Label>
          <Select name="status" defaultValue={job?.status ?? defaultStatus}>
            <SelectTrigger id={`${ids}-status`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error("status")}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${ids}-dateApplied`}>Date applied</Label>
          <Input {...field("dateApplied")} type="date" defaultValue={job?.dateApplied ?? ""} />
          {error("dateApplied")}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${ids}-salary`}>Salary</Label>
          <Input {...field("salary")} placeholder="e.g. 120–140k" defaultValue={job?.salary ?? ""} />
          {error("salary")}
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor={`${ids}-notes`}>Notes</Label>
        <Textarea {...field("notes")} rows={4} defaultValue={job?.notes ?? ""} />
        {error("notes")}
      </div>

      <DialogFooter className="gap-2 sm:justify-between">
        {job ? <DeleteJobButton job={job} onDeleted={onDone} /> : <span />}
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function DeleteJobButton({ job, onDeleted }: { job: JobDTO; onDeleted: () => void }) {
  const [isDeleting, startTransition] = useTransition();

  function confirmDelete() {
    startTransition(async () => {
      try {
        await deleteJob(job.id);
        toast.success("Job deleted");
        onDeleted();
      } catch {
        toast.error("Couldn't delete the job.");
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="destructive" disabled={isDeleting}>
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this job?</AlertDialogTitle>
          <AlertDialogDescription>
            {job.companyName} · {job.title} will be removed along with its interviews. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
