import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Board } from "@/components/board/Board";
import { ghostAfterDays } from "@/lib/config";
import { getBoardJobs, getCompanyNames } from "@/lib/queries";

export const metadata: Metadata = { title: "Board · Jobsy" };

export default function BoardPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground text-sm">Loading board…</p>}>
      <BoardData />
    </Suspense>
  );
}

async function BoardData() {
  await connection(); // read fresh data on every request
  const [jobs, companies] = await Promise.all([getBoardJobs(), getCompanyNames()]);
  return <Board initialJobs={jobs} companies={companies} ghostDays={ghostAfterDays()} now={new Date().toISOString()} />;
}
