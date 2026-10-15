import Link from "next/link";
import { UserPlus } from "lucide-react";
import { PortalFormPage } from "@/components/portal/page-header";
import { Button } from "@/components/ui/button";
import { getClassFormOptions } from "@/lib/classes/options";
import { ClassForm } from "../class-form";

export default async function NewClassPage() {
  const options = await getClassFormOptions();
  const { teachers } = options;

  return (
    <PortalFormPage backHref="/portal/classes" backLabel="Back to classes"
      label="Classes" title="Add class" description="Assign a teacher and choose a branch, program and subject. The teacher adds their own Google Sheets link.">
      {teachers.length > 0 ? (
        <ClassForm mode="create" {...options} />
      ) : (
        <section className="max-w-3xl rounded-lg border border-border bg-card p-5 shadow-sm" aria-label="Add a teacher first">
          <h2 className="text-base font-semibold">Set up a teacher account first</h2>
          <p className="mt-2 text-sm text-muted-foreground">Send an account setup email to an employee with the Teacher role. Once they verify their email and set a password, return here to assign the class.</p>
          <Button asChild className="mt-4"><Link href="/portal/teachers"><UserPlus aria-hidden="true" />Manage teachers</Link></Button>
        </section>
      )}
    </PortalFormPage>
  );
}
