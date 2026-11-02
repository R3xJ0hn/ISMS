import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth";
import { getAcademicSchemes } from "@/lib/academics/admin";
import { PortalFormPage } from "@/components/portal/page-header";
import { SchemeForm } from "../scheme-form";

export default async function NewAcademicSchemePage({
  searchParams,
}: {
  searchParams: Promise<{ copy?: string }>;
}) {
  await requireSuperAdmin();
  const { copy } = await searchParams;
  const original = copy
    ? (await getAcademicSchemes()).find((scheme) => scheme.id === copy)
    : undefined;
  if (copy && !original) notFound();
  return (
    <PortalFormPage
      backHref="/portal/academic-terms"
      backLabel="Back to academic terms"
      label="Academics"
      title={copy ? "Duplicate academic scheme" : "Add academic scheme"}
      description="Choose the terms and grading periods for a reusable academic calendar."
    >
      <SchemeForm
        initial={
          original
            ? {
                name: `${original.name.slice(0, 110)} Copy`,
                terms: original.terms,
              }
            : undefined
        }
      />
    </PortalFormPage>
  );
}
