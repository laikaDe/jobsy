import { connection } from "next/server";
import { Suspense } from "react";
import { StatTile } from "@/components/dashboard/StatTile";
import { AddJobButton } from "@/components/job-form/AddJobButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { computeDashboard, formatDays, formatRate } from "@/lib/analytics";
import { ghostAfterDays } from "@/lib/config";
import { getCompanyNames, getJobFacts } from "@/lib/queries";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <Suspense fallback={<p className="text-muted-foreground text-sm">Loading numbers…</p>}>
        <DashboardData />
      </Suspense>
    </div>
  );
}

async function DashboardData() {
  await connection(); // fresh numbers on every request
  const ghostDays = ghostAfterDays();
  const jobs = await getJobFacts();
  const stats = computeDashboard(jobs, new Date(), ghostDays);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Total Applied" value={stats.totalApplied} />
        <StatTile label="Active Interviews" value={stats.activeInterviews} />
        <StatTile label="Ghosted / Rejected" value={stats.ghostedOrRejected} hint={`Ghosted = Applied, no change for ${ghostDays}+ days`} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile size="sm" label="Applied → Interview" value={formatRate(stats.conversionRate)} />
        <StatTile size="sm" label="Avg days in Applied" value={formatDays(stats.avgDaysInApplied)} />
      </div>
      {jobs.length === 0 && <EmptyState />}
    </>
  );
}

async function EmptyState() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>No jobs yet</CardTitle>
        <CardDescription>Add your first application to start tracking.</CardDescription>
      </CardHeader>
      <CardContent>
        <AddJobButton companies={await getCompanyNames()} />
      </CardContent>
    </Card>
  );
}
