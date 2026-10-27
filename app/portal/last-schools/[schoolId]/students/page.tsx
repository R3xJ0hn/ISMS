import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Pencil, Search } from "lucide-react";
import { PortalTable, type PortalTableColumn } from "@/components/portal/data-table";
import { PortalEmptyState, PortalFormPage } from "@/components/portal/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApplicationStatus } from "@/lib/generated/prisma/enums";
import { getApplicationStatusLabel } from "@/lib/admission/status";
import { getManagedLastSchoolStudents } from "@/lib/last-schools/admin";
import type { LastSchoolStudentRow } from "@/lib/last-schools/types";

const columns: PortalTableColumn<LastSchoolStudentRow>[] = [
  { header: "Student", cell: (student) => <span className="font-medium">{student.name}</span> },
  { header: "Student number", cell: (student) => student.studentNumber || <span className="text-muted-foreground">Pending</span> },
  { header: "Program", cell: (student) => student.program },
  { header: "Branch", cell: (student) => student.branch },
  { header: "Status", cell: (student) => <span className="inline-flex whitespace-nowrap rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium">{getApplicationStatusLabel(student.applicationStatus)}</span> },
  { header: "Actions", cell: (student) => <Link
    href={student.applicationStatus === ApplicationStatus.approved
      ? `/portal/students/${student.applicationId}/edit` : `/portal/admission/${student.applicationId}/edit`}
    className="inline-flex items-center gap-2 whitespace-nowrap font-medium text-primary underline-offset-4 hover:underline"
    aria-label={`Edit ${student.name}`}><Pencil className="size-4" aria-hidden="true" />Edit student</Link> },
];

export default async function LastSchoolStudentsPage({ params, searchParams }: {
  params: Promise<{ schoolId: string }>;
  searchParams?: Promise<{ q?: string | string[]; page?: string | string[] }>;
}) {
  const [{ schoolId }, search] = await Promise.all([params, searchParams]);
  const data = await getManagedLastSchoolStudents(schoolId, { query: search?.q, page: search?.page });
  if (!data) notFound();
  const baseHref = `/portal/last-schools/${data.school.id}/students`;
  const pageHref = (page: number) => {
    const query = new URLSearchParams();
    if (data.query) query.set("q", data.query);
    if (page > 1) query.set("page", String(page));
    return query.size ? `${baseHref}?${query.toString()}` : baseHref;
  };
  const start = data.total ? (data.page - 1) * data.pageSize + 1 : 0;
  const end = Math.min(data.page * data.pageSize, data.total);

  return (
    <PortalFormPage className="min-w-0" backHref="/portal/last-schools" backLabel="Back to last schools" label="Manage Last Schools"
      title="Linked students" description={`Admission records that list ${data.school.schoolName || "this school"} as the last school attended.`}>
      <p className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        Choose Edit student to correct a student&apos;s last school. Students can appear more than once if multiple admission records use this school.
      </p>
      <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-card shadow-sm" aria-label="Students linked to this school">
        <form action={baseHref} method="get" role="search" className="flex flex-wrap items-end gap-3 border-b border-border p-4">
          <div className="min-w-0 flex-1 sm:max-w-md">
            <label htmlFor="school-students-query" className="sr-only">Search linked students</label>
            <Input key={data.query} id="school-students-query" name="q" type="search" role="searchbox" defaultValue={data.query} maxLength={120}
              placeholder="Search name, student number, program, or branch..." />
          </div>
          <Button type="submit" variant="outline"><Search aria-hidden="true" />Search</Button>
          {data.query && <Button asChild variant="ghost"><Link href={baseHref}>Clear search</Link></Button>}
        </form>
        <PortalTable rows={data.students} columns={columns} rowKey={(student) => student.applicationId} className="min-w-200"
          scrollAreaLabel="Linked students table" scrollAreaClassName="max-h-[min(60vh,36rem)] overflow-auto focus-visible:outline-2 focus-visible:outline-ring" stickyHeader
          emptyState={<PortalEmptyState title={data.query ? "No matching students" : "No linked students"}
            description={data.query ? "Try another name or student number, or clear the search." : "Students will appear here when their admission record uses this school."} />} />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4">
          <p role="status" className="text-sm text-muted-foreground">Showing {start}-{end} of {data.total} admission records</p>
          {data.totalPages > 1 && <nav aria-label="Linked student pagination" className="flex items-center gap-2">
            {data.page > 1
              ? <Button asChild variant="outline" size="icon-sm"><Link href={pageHref(data.page - 1)} rel="prev" aria-label="Previous page"><ChevronLeft aria-hidden="true" /></Link></Button>
              : <Button variant="outline" size="icon-sm" disabled aria-label="Previous page"><ChevronLeft aria-hidden="true" /></Button>}
            <span className="whitespace-nowrap text-sm">Page {data.page} of {data.totalPages}</span>
            {data.page < data.totalPages
              ? <Button asChild variant="outline" size="icon-sm"><Link href={pageHref(data.page + 1)} rel="next" aria-label="Next page"><ChevronRight aria-hidden="true" /></Link></Button>
              : <Button variant="outline" size="icon-sm" disabled aria-label="Next page"><ChevronRight aria-hidden="true" /></Button>}
          </nav>}
        </div>
      </section>
    </PortalFormPage>
  );
}
