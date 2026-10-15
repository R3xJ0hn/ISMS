import Link from "next/link";
import { notFound } from "next/navigation";
import { PortalFormPage } from "@/components/portal/page-header";
import { Button } from "@/components/ui/button";
import { getTeacherEmployeeForInvitation } from "@/lib/teachers/admin";
import { formatDateTime } from "@/lib/utils";
import { TeacherSetupEmailForm } from "../../teacher-invitation-form";

export default async function EditTeacherPage({ params }: { params: Promise<{ teacherId: string }> }) {
  const teacher = await getTeacherEmployeeForInvitation((await params).teacherId);
  if (!teacher) notFound();

  return (
    <PortalFormPage backHref="/portal/teachers" backLabel="Back to teachers"
      label="Teachers" title="Account setup" description={`Review portal activation for ${teacher.fullName}.`} headerActions={
        <Button asChild variant="outline"><Link href={`/portal/employees/${teacher.employeeRecordId}/edit`}>Edit employee profile</Link></Button>
      }>
      <section className="w-full max-w-2xl rounded-lg border border-border bg-card p-5 shadow-sm" aria-label="Teacher employee details">
        <dl className="grid gap-5 sm:grid-cols-2">
          {[
            ["Employee ID", teacher.employeeId], ["Full name", teacher.fullName],
            ["Email address", teacher.emailAddress], ["Contact number", teacher.contactNumber],
            ["Employee status", teacher.status], ["Account status", teacher.accountStatus],
            ["Last setup email", teacher.invitationCreatedAt ? formatDateTime(new Date(teacher.invitationCreatedAt)) : "Not sent"],
          ].map(([label, value]) => <div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>)}
        </dl>
      </section>
      <TeacherSetupEmailForm teacher={teacher} />
    </PortalFormPage>
  );
}
