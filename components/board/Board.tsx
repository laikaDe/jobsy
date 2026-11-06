"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useId, useState } from "react";
import { toast } from "sonner";
import { moveJob } from "@/app/actions";
import { JobFormDialog } from "@/components/job-form/JobFormDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { COLUMNS, columnFor, type Status } from "@/lib/status";
import type { JobDTO } from "@/lib/types";
import { Column } from "./Column";
import { JobCard } from "./JobCard";

type Props = {
  initialJobs: JobDTO[];
  companies: string[];
  ghostDays: number;
  /** Server render time (ISO) so "days in stage" matches between server and client. */
  now: string;
};

type FormState = { open: false } | { open: true; job: JobDTO | null; defaultStatus: Status };

const CLOSED_ORDER: Record<string, number> = { OFFER: 0, REJECTED: 1 };

function sortForColumn(jobs: JobDTO[]) {
  return [...jobs].sort(
    (a, b) =>
      (CLOSED_ORDER[a.status] ?? 0) - (CLOSED_ORDER[b.status] ?? 0) ||
      b.statusChangedAt.localeCompare(a.statusChangedAt),
  );
}

export function Board({ initialJobs, companies, ghostDays, now }: Props) {
  const [jobs, setJobs] = useState(initialJobs);
  const [form, setForm] = useState<FormState>({ open: false });
  const [pendingClosedDrop, setPendingClosedDrop] = useState<string | null>(null);
  const nowDate = new Date(now);
  const dndId = useId(); // stable id so dnd-kit's aria ids match between server and client

  // Re-sync with fresh server data after revalidatePath re-renders the page
  // (state adjusted during render rather than in an effect).
  const [syncedFrom, setSyncedFrom] = useState(initialJobs);
  if (syncedFrom !== initialJobs) {
    setSyncedFrom(initialJobs);
    setJobs(initialJobs);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  async function move(id: string, next: Status) {
    const prev = jobs; // 1. snapshot
    const job = prev.find((j) => j.id === id);
    if (!job || job.status === next) return;
    setJobs(
      prev.map((j) => (j.id === id ? { ...j, status: next, statusChangedAt: new Date().toISOString() } : j)),
    ); // 2. optimistic: the card jumps now
    try {
      await moveJob(id, next); // 3. persist; 4. on success revalidatePath sends fresh initialJobs
    } catch {
      setJobs(prev); // 5. roll back
      toast.error("Move not saved — check the database connection.");
    }
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over) return;
    const job = jobs.find((j) => j.id === active.id);
    if (!job) return;
    const target = COLUMNS.find((c) => c.id === over.id);
    if (!target || target.id === columnFor(job.status)) return; // same column → no-op
    if (target.id === "closed") {
      setPendingClosedDrop(job.id); // ask Offer or Rejected
      return;
    }
    void move(job.id, target.dropStatus);
  }

  function resolveClosedDrop(status: Status | null) {
    const id = pendingClosedDrop;
    setPendingClosedDrop(null);
    if (id && status) void move(id, status);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Board</h1>

      <DndContext id={dndId} sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {COLUMNS.map((col) => {
            const colJobs = sortForColumn(jobs.filter((j) => (col.statuses as readonly Status[]).includes(j.status)));
            return (
              <Column
                key={col.id}
                id={col.id}
                title={col.title}
                count={colJobs.length}
                onAdd={() => setForm({ open: true, job: null, defaultStatus: col.dropStatus })}
              >
                {colJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    now={nowDate}
                    ghostDays={ghostDays}
                    onOpen={(j) => setForm({ open: true, job: j, defaultStatus: j.status })}
                    onMove={move}
                  />
                ))}
              </Column>
            );
          })}
        </div>
      </DndContext>

      <JobFormDialog
        open={form.open}
        onOpenChange={(open) => !open && setForm({ open: false })}
        job={form.open ? form.job : null}
        defaultStatus={form.open ? form.defaultStatus : "WISHLIST"}
        companies={companies}
      />

      <AlertDialog open={pendingClosedDrop !== null} onOpenChange={(open) => !open && resolveClosedDrop(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Offer or rejected?</AlertDialogTitle>
            <AlertDialogDescription>How did this one end?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => resolveClosedDrop(null)}>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={() => resolveClosedDrop("REJECTED")}>
              Rejected
            </Button>
            <AlertDialogAction autoFocus onClick={() => resolveClosedDrop("OFFER")}>
              Offer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
