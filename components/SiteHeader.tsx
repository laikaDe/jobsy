import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AddJobButton } from "@/components/job-form/AddJobButton";
import { NavLinks } from "@/components/NavLinks";
import { Button } from "@/components/ui/button";
import { getCompanyNames } from "@/lib/queries";

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
        <Link href="/" className="font-semibold tracking-tight">
          Jobsy
        </Link>
        <NavLinks />
        <div className="ml-auto">
          <Suspense fallback={<Button disabled>Add job</Button>}>
            <HeaderAddJob />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

async function HeaderAddJob() {
  await connection();
  return <AddJobButton companies={await getCompanyNames()} />;
}
