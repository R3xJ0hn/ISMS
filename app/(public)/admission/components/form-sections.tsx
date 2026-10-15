"use client";

import { FormFields } from "./form-fields";
import { detailsSteps, type DetailsFieldName, type DetailsStepId } from "./form-schema";
import { LastSchoolStep, type LastSchoolFieldName } from "./last-school-step";

export { studentUpdateSections } from "./form-schema";

export function DetailsStep({ stepId, form, onChange }: {
  stepId: DetailsStepId;
  form: Record<DetailsFieldName, string> & { last_school_record_id?: string };
  onChange: (field: LastSchoolFieldName, value: string) => void;
}) {
  if (stepId === "lastSchool") return <LastSchoolStep form={form} onChange={onChange} />;
  const step = detailsSteps[stepId];
  return (
    <div className="min-w-0 space-y-6 sm:space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-gray-950">{step.title}</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">{step.description}</p>
      </div>
      {step.sections.map((section) => (
        <section key={section.title ?? step.title} className="min-w-0 space-y-4 sm:space-y-5">
          {section.title && <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-700">{section.title}</h4>}
          <FormFields fields={section.fields} values={form} onChange={onChange} />
        </section>
      ))}
    </div>
  );
}
