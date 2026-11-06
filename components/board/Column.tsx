"use client";

import { useDroppable } from "@dnd-kit/core";
import { PlusIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  title: string;
  count: number;
  onAdd: () => void;
  children: ReactNode;
};

export function Column({ id, title, count, onAdd, children }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section
      ref={setNodeRef}
      data-testid={`column-${id}`}
      aria-label={`${title} column`}
      className={cn(
        "bg-muted/50 flex min-h-64 flex-col gap-2 rounded-xl border p-2 transition-colors",
        isOver && "border-primary bg-primary/5",
      )}
    >
      <header className="flex items-center justify-between px-1">
        <h2 className="text-sm font-medium">
          {title} <span className="text-muted-foreground tabular-nums" data-testid="column-count">{count}</span>
        </h2>
        <Button variant="ghost" size="icon-sm" onClick={onAdd} aria-label={`Add job to ${title}`}>
          <PlusIcon />
        </Button>
      </header>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}
