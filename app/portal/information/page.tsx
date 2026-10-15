import type { ReactNode } from "react";
import { BookOpen, BriefcaseBusiness, ContactRound, GraduationCap, UserRound, Users } from "lucide-react";
import { formatAcademicLevel } from "@/lib/academic-levels";
import { formatProgramType, formatRoleLabel } from "@/lib/utils";
import { getMyInformation } from "@/lib/portal/information";

function displayDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat("en", {
    month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  }).format(date);
}

function InformationSection({ title, icon, fields }: {
  title: string;
  icon: ReactNode;
  fields: Array<[label: string, value: string | null | undefined]>;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-3"><span className="text-primary">{icon}</span><h2 className="font-semibold">{title}</h2></div>
      <dl className="grid min-w-0 gap-5 sm:grid-cols-2">
        {fields.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-medium [overflow-wrap:anywhere]">{value?.trim() || "Not recorded"}</dd></div>)}
      </dl>
    </section>
  );
}

export default async function MyInformationPage() {
  const { role, accountEmail, profile } = await getMyInformation();
  const roleLabel = role === "teacher" ? "Teacher" : "Student";
  return (
    <main className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header><h1 className="text-3xl font-semibold tracking-tight">My information</h1><p className="mt-2 text-sm text-muted-foreground">{role === "teacher" ? "Your saved personal and employee details." : "Your saved personal and school details."}</p></header>
      {!profile ? (
        <section className="rounded-2xl border border-dashed border-border bg-card p-6 sm:p-8">
          <h2 className="font-semibold">Your {role === "teacher" ? "employee" : "student"} record is unavailable</h2>
          <p className="mt-2 text-sm text-muted-foreground">Contact the administrator to check the record linked to your account.</p>
          <dl className="mt-5 text-sm"><dt className="text-muted-foreground">Account email</dt><dd className="mt-1 font-medium [overflow-wrap:anywhere]">{accountEmail}</dd></dl>
        </section>
      ) : (
        <>
          <section className="flex min-w-0 items-start gap-4 rounded-2xl border border-border bg-card p-5 sm:p-6" aria-label="Your profile">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-primary"><UserRound aria-hidden="true" className="size-6" /></span>
            <div className="min-w-0 flex-1"><p className="text-xl font-semibold [overflow-wrap:anywhere]">{profile.name}</p><p className="mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">{profile.kind === "teacher" ? `Employee ID: ${profile.employment.employeeId}` : `Student number: ${profile.studentNumber ?? "Not assigned"}`}</p></div>
            <span className="hidden rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground sm:inline-block">{roleLabel}</span>
          </section>
          <div className="grid min-w-0 gap-5 lg:grid-cols-2">
            <InformationSection title="Personal information" icon={<UserRound aria-hidden="true" className="size-5" />} fields={[
              ["Full name", profile.name], ["Date of birth", displayDate(profile.personal.birthDate)],
              ["Place of birth", profile.personal.birthplace], ["Gender", profile.personal.gender],
              ["Civil status", profile.personal.civilStatus], ["Nationality / Citizenship", profile.personal.nationality],
              ...(profile.kind === "student" ? [["Religion", profile.personal.religion] as [string, string | null]] : []),
            ]} />
            <InformationSection title="Contact information" icon={<ContactRound aria-hidden="true" className="size-5" />} fields={[
              ["Account email", accountEmail], ["Record email", profile.contact.email], ["Contact number", profile.contact.phone],
              ["Address", profile.contact.address],
              ...(profile.kind === "student" ? [["Facebook account", profile.contact.facebookAccount] as [string, string | null]] : []),
            ]} />
            {profile.kind === "teacher" ? (
              <InformationSection title="Employment information" icon={<BriefcaseBusiness aria-hidden="true" className="size-5" />} fields={[
                ["Employee ID", profile.employment.employeeId], ["Role", formatRoleLabel(profile.employment.role)],
                ["Employment status", profile.employment.status], ["Date started", displayDate(profile.employment.dateStarted)],
              ]} />
            ) : (
              <>
                <InformationSection title="School information" icon={<GraduationCap aria-hidden="true" className="size-5" />} fields={[
                  ["Student number", profile.studentNumber], ["Branch", profile.admission?.branch],
                  ["Program", profile.admission?.program], ["Program type", profile.admission ? formatProgramType(profile.admission.programType) : null],
                  ["Year level", profile.admission ? formatAcademicLevel(profile.admission.yearLevel) : null],
                  ["Application status", profile.admission ? formatRoleLabel(profile.admission.status) : null],
                ]} />
                <InformationSection title="Guardian information" icon={<Users aria-hidden="true" className="size-5" />} fields={[
                  ["Name", profile.guardian?.name], ["Relationship", profile.guardian?.relationship],
                  ["Contact number", profile.guardian?.phone], ["Occupation", profile.guardian?.occupation],
                ]} />
                <InformationSection title="Previous school" icon={<BookOpen aria-hidden="true" className="size-5" />} fields={[
                  ["School name", profile.admission?.lastSchool?.name], ["School type", profile.admission?.lastSchool?.type],
                  ["School year", profile.admission?.lastSchool?.schoolYear], ["Attained level", profile.admission?.lastSchool?.attainedLevel],
                  ["Graduation date", displayDate(profile.admission?.lastSchool?.graduationDate)],
                ]} />
              </>
            )}
          </div>
          <p className="text-sm text-muted-foreground">Contact the administrator if any saved information needs to be corrected.</p>
        </>
      )}
    </main>
  );
}
