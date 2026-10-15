import Link from "next/link";
import { Plus } from "lucide-react";
import { PortalCount, PortalPageHeader } from "@/components/portal/page-header";
import { Button } from "@/components/ui/button";
import { getSubjects } from "@/lib/subjects/admin";
import { SubjectsTable } from "./subjects-table";

export default async function SubjectsManagementPage() {
  const subjects = await getSubjects();
  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <PortalPageHeader label="Management" title="Manage Subjects" description="Maintain the subjects available for programs and classes.">
        <div className="flex flex-wrap items-center gap-3">
          <PortalCount count={subjects.length} label="subjects" />
          <Button asChild><Link href="/portal/subjects/new"><Plus aria-hidden="true" />Add subject</Link></Button>
        </div>
      </PortalPageHeader>
      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm" aria-label="Subject records">
        <SubjectsTable subjects={subjects} />
      </section>
    </main>
  );
}
