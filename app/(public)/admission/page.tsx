import { SCHOOL } from "@/lib/public/site";
import type { Metadata } from "next";
import Image from "next/image";

import AdmissionWizard from "@/app/(public)/admission/components/admission-wizard";

export const metadata: Metadata = {
  title: "Admissions | ISMS Application",
  description:
    "Step-by-step admission application UI for Datamex College of Saint Adeline.",
};

export default function AdmissionPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-gray-950 text-white">
        <Image
          src={SCHOOL.assets.campus}
          alt="Datamex students preparing for admission"
          fill
          className="object-cover opacity-45"
          sizes="100vw"
          priority
        />
        <div className="absolute inset-0 bg-primary/70" />
        <div className="absolute inset-x-0 bottom-0 h-6 bg-gray-50 lg:h-12" />

        <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pb-24 lg:pt-15">
          <h1 className="max-w-4xl text-3xl font-black tracking-tight sm:text-4xl lg:mt-4 lg:text-6xl">
            Apply one step at a time
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/88 sm:text-base lg:mt-5 lg:text-lg lg:leading-7">
            Complete your admission details, review your information, and
            prepare the required documents before registrar validation.
          </p>
        </div>
      </section>

      <AdmissionWizard />
    </>
  );
}
