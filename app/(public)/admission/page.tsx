import type { Metadata } from "next";
import Image from "next/image";

import AdmissionWizard from "@/app/(public)/admission/componets/admission-wizard";
import Footer from "@/components/public/footer";

export const metadata: Metadata = {
  title: "Admissions | ISMS Application",
  description:
    "Step-by-step admission application UI for Datamex College of Saint Adeline.",
};

export default function AdmissionPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-gray-950 text-white mb-3">
        <Image
          src="https://res.cloudinary.com/dghjtnxjw/image/upload/v1772362161/uploads/uzmj1kgeurubodkbxpu4.jpg"
          alt="Datamex students preparing for admission"
          fill
          className="object-cover opacity-45"
          sizes="100vw"
          priority
        />
        <div className="absolute inset-0 bg-primary/70" />
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gray-50" />

        <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-5 sm:px-6 sm:pt-15 lg:px-8">
          <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
            Apply one step at a time
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/88 sm:text-lg">
            Complete your admission details, review your information, and
            prepare the required documents before registrar validation.
          </p>
        </div>
      </section>

      <AdmissionWizard />

      <Footer />
    </>
  );
}
