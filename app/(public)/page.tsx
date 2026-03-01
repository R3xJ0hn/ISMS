import CoreValuesSection from "@/components/public/core-values";
import Footer from "@/components/public/footer";
import Hero from "@/components/public/hero";
import SchoolBranches from "@/components/public/school-branches";
import SchoolLife from "@/components/public/school-life";
import { BookMarked, GraduationCap, ToolCase } from "lucide-react";
import Image from "next/image";

export default function page() {
  return (
    <>
      <Hero />

      {/* BANNER SECTION */}
      <section className="relative bg-white py-20 w-screen overflow-hidden">
        <div className="relative rounded-xl">
          {/* Banner Image */}
          <Image
            src="https://res.cloudinary.com/dghjtnxjw/image/upload/v1772361809/uploads/tsulcyttkz5ijntl5wpi.png"
            alt="School Banner"
            width={1600}
            height={500}
            className="w-11/12 object-cover  mx-auto shadow-lg hover:scale-102 transition-transform duration-300"
            priority
          />
        </div>
      </section>

      {/* WHY SECTION */}
      <section className="w-full bg-white pb-20">
        <h1 className="text-4xl font-bold text-center mb-12 text-gray-900">
          Why Datamex College of Saint Adeline?
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 w-10/12 mx-auto border border-primary rounded-xl overflow-hidden shadow-lg">
          <div className="bg-primary text-white px-8 md:px-16  items-center p-10">
            <h3 className="text-2xl font-bold mb-5 uppercase">
              {" "}
              At Datamex College of Saint Adeline
            </h3>
            <p className="text-lg text-justify max-w-4xl mx-auto leading-relaxed ">
              We take pride in offering specialized academic programs designed
              to prepare students for real-world success. Though focused in
              scope, our programs are thoughtfully crafted to meet industry
              standards and equip learners with practical skills, technical
              competence, and professional confidence. Our passionate and
              experienced faculty members go beyond traditional teaching they
              mentor, guide, and inspire students to reach their full potential.
              With a supportive and dynamic learning environment, we ensure that
              every student receives personalized attention and meaningful
              educational experiences. At Datamex College of Saint Adeline, we
              don’t just educate—we empower. We prepare our students to stand
              out, adapt, and thrive in today’s competitive and ever-evolving
              professional landscape.
            </p>
          </div>

          <div className="relative w-full h-full lg:h-auto p-5">
            <Image
              src="https://res.cloudinary.com/dghjtnxjw/image/upload/v1772362161/uploads/uzmj1kgeurubodkbxpu4.jpg"
              alt="Future of Education"
              fill
              className="object-cover"
            />
          </div>
        </div>
      </section>

      <CoreValuesSection />

      <SchoolLife />

      {/* COURSE OFFER */}
      <section className="relative overflow-hidden py-7 bg-gray-100 ">
        {/* subtle background */}
        <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-black/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-black/5 blur-3xl" />

        {/* 11/12 width container */}
        <div className="mx-auto w-11/12 max-w-6xl">
          {/* HEADER (same structure as original) */}
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              DCSA PROGRAMS
            </h1>

            <p className="mx-auto mt-3 inline-flex rounded-full border bg-secondary text-white px-5 py-2 text-sm font-semibold tracking-wide">
              YOUR PATH TO SUCCESS STARTS HERE
            </p>
          </div>

          {/* CARDS */}
          <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* College Courses */}
            <div className="group rounded-2xl border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h5 className="text-lg font-bold">College Courses</h5>
                  <p className="mt-1 text-xs text-gray-500">
                    Degree programs for long-term careers
                  </p>
                </div>

                <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-white transition group-hover:scale-105">
                  <GraduationCap />
                </div>
              </div>

              <div className="mt-5 h-px w-full bg-gray-100" />

              <ul className="mt-5 space-y-3 text-sm text-gray-700">
                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-black" />
                  Bachelor of Science in Information Technology
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-black" />
                  Bachelor of Science in Office Administration
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-black" />
                  Bachelor of Science in Tourism Management
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-black" />
                  Bachelor of Science in Hotel Management
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-black" />
                  <span>
                    Associate in Computer Technology
                    <span className="mt-1 block text-xs text-gray-500">
                      (2-years course laderize to BSIT)
                    </span>
                  </span>
                </li>
              </ul>
            </div>

            {/* TVL Track */}
            <div className="group rounded-2xl border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h5 className="text-lg font-bold">TVL Track</h5>
                  <p className="mt-1 text-xs text-gray-500">
                    Skills-based training for work readiness
                  </p>
                </div>

                <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-white transition group-hover:scale-105">
                  <ToolCase />
                </div>
              </div>

              <div className="mt-5 h-px w-full bg-gray-100" />

              <ul className="mt-5 space-y-3 text-sm text-gray-700">
                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-black" />
                  Information and Communications Technology
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-black" />
                  Home Economics
                </li>
              </ul>
            </div>

            {/* Academic Track */}
            <div className="group rounded-2xl border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h5 className="text-lg font-bold">Academic Track</h5>
                  <p className="mt-1 text-xs text-gray-500">
                    Strong foundation for university pathways
                  </p>
                </div>

                <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-white transition group-hover:scale-105">
                  <BookMarked />
                </div>
              </div>

              <div className="mt-5 h-px w-full bg-gray-100" />

              <ul className="mt-5 space-y-3 text-sm text-gray-700">
                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-black" />
                  Science, Technology, Engineering &amp; Mathematics
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-black" />
                  Accountancy, Business &amp; Management
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-black" />
                  Humanities &amp; Social Sciences
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-black" />
                  General Academic Strand
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

    <section className="w-full bg-white">
      {/* top thick bar */}
      <div className="h-10 w-full bg-primary" />

      {/* content area */}
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="relative rounded-sm bg-white">
          <div className="mx-auto max-w-4xl">
            <div className="flex items-center gap-4">
              <div className="relative h-14 w-14">
            <Image src="https://res.cloudinary.com/dghjtnxjw/image/upload/v1772363064/uploads/czeccbdle54njfottdz1.png"
                  alt="Datamex College of Saint Adeline"
                  fill
                  className="object-contain"
                  sizes="56px"
                  priority
                />
              </div>

              <div className="leading-tight">
                <div className="flex items-baseline gap-3">
                  <h2 className="text-3xl font-extrabold tracking-tight text-primary">
                    DATAMEX
                  </h2>
                </div>
                <p className="mt-1 text-xs font-semibold tracking-[0.22em] text-secondary">
                  COLLEGE OF SAINT ADELINE
                </p>
              </div>
            </div>

            <div className="mt-10 max-w-2xl">
              <h3 className="text-base font-semibold text-secondary uppercase tracking-wide">
                Are you ready to embark on your academic journey?
              </h3>

              <p className="mt-8  leading-7 ">
                We encourage you to connect with us through our Facebook pages
                or contact your preferred branch directly for any enrollment
                inquiries. If you do not have any further questions, we invite
                you to apply today.
              </p>

              <p className="mt-8  leading-7 ">
                Your future starts here, and we are eager to assist you every
                step of the way.
              </p>

              {/* Button aligned under the text block */}
              <div className="mt-12">
                <a
                  href="/apply" // change this
                  className="inline-flex items-center justify-center bg-secondary px-16 py-4 text-sm font-semibold uppercase tracking-widest text-white transition
                             hover:bg-marron focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                >
                  Apply Now
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* bottom thick bar */}
      <div className="h-10 w-full bg-primary" />
    </section>

      <SchoolBranches />
      
      <Footer />
    </>
  );
}

