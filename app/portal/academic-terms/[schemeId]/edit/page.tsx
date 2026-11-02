import { notFound } from "next/navigation";
import Link from "next/link";
import { getAcademicSchemes } from "@/lib/academics/admin";
import { PortalFormPage } from "@/components/portal/page-header";
import { SchemeForm } from "../../scheme-form";

export default async function EditAcademicSchemePage({
  params,
}: {
  params: Promise<{ schemeId: string }>;
}) {
  const { schemeId } = await params;
  const scheme = (await getAcademicSchemes()).find(
    (item) => item.id === schemeId,
  );
  if (!scheme) notFound();
  return (
    <PortalFormPage
      backHref="/portal/academic-terms"
      backLabel="Back to academic terms"
      label="Academics"
      title="Edit academic scheme"
      description="Keep term and grading-period names in their intended order."
    >
      {scheme.inUse ? (
        <p>
          This scheme is in use.{" "}
          <Link
            className="underline"
            href={`/portal/academic-terms/new?copy=${scheme.id}`}
          >
            Duplicate it to create a new version.
          </Link>
        </p>
      ) : (
        <SchemeForm
          schemeId={scheme.id}
          revision={scheme.revision}
          initial={{ name: scheme.name, terms: scheme.terms }}
        />
      )}
    </PortalFormPage>
  );
}
