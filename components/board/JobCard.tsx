"use client";

import { useDraggable } from "@dnd-kit/core";
import { EllipsisIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { daysBetween, isGhosted } from "@/lib/analytics";
import { STATUS_LABELS, STATUSES, type Status } from "@/lib/status";
import type { JobDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  job: JobDTO;
  now: Date;
  ghostDays: number;
  onOpen: (job: JobDTO) => void;
  onMove: (id: string, status: Status) => void;
};

export function JobCard({ job, now, ghostDays, onOpen, onMove }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: job.id,
    data: { status: job.status },
  });
  const changedAt = new Date(job.statusChangedAt);
  const days = Math.floor(daysBetween(changedAt, now));
  const ghosted = isGhosted({ status: job.status, statusChangedAt: changedAt }, now, ghostDays);

  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      data-testid="job-card"
      data-job-id={job.id}
      className={cn(
        "bg-card text-card-foreground relative rounded-lg border shadow-xs",
        isDragging && "z-50 opacity-80 shadow-lg",
      )}
    >
      {/* Drag handle + click target. The menu is a sibling so its events never reach the drag listeners. */}
      <div
        {...listeners}
        {...attributes}
        aria-label={`${job.companyName}, ${job.title}. Press space to drag, or use the menu to move.`}
        onClick={() => onOpen(job)}
        className="cursor-grab touch-none p-3 pr-10 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg active:cursor-grabbing"
      >
        <p className="truncate text-sm font-semibold">{job.companyName}</p>
        <p className="text-muted-foreground truncate text-sm">{job.title}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground text-xs tabular-nums" title="Days in current stage">
            {days}d
          </span>
          {job.status === "OFFER" && <Badge className="bg-emerald-600 text-white">Offer</Badge>}
          {job.status === "REJECTED" && <Badge variant="destructive">Rejected</Badge>}
          {ghosted && <Badge variant="secondary">Ghosted</Badge>}
        </div>
      </div>

      <div className="absolute top-1.5 right-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${job.companyName}, ${job.title}`}>
              <EllipsisIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onOpen(job)}>Edit…</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Move to…</DropdownMenuLabel>
            {STATUSES.filter((s) => s !== job.status).map((s) => (
              <DropdownMenuItem key={s} onSelect={() => onMove(job.id, s)}>
                {STATUS_LABELS[s]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
