"use client";

import Autoplay from "embla-carousel-autoplay";
import * as React from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";

const slides = [
  {
    title: "S.Y. 2026-2027",
    highlight: "APPLICATIONS",
    subtitle: "ARE NOW OPEN",
    school: "FOR COLLEGE & SHS",
    location: "DATAMEX COLLEGE OF SAINT ADELINE",
  },
  {
    title: "YOUR PATH TO",
    highlight: "SUCCESS",
    subtitle: "STARTS HERE",
    school: "DATAMEX COLLEGE OF SAINT ADELINE",
    location: "MEYCAUAYAN",
  },
  {
    title: "BUILD YOUR",
    highlight: "FUTURE",
    subtitle: "WITH US",
    school: "QUALITY EDUCATION",
    location: "FOR TOMORROW",
  },
];

function HeroCarousel() {
  const [autoplay] = React.useState(() =>
    Autoplay({
      delay: 3000, // 3 seconds
      stopOnInteraction: false,
      stopOnMouseEnter: true, // pause on hover (optional)
    })
  );

  return (
    <Carousel
      plugins={[autoplay]}
      opts={{ loop: true }}
      className="w-full"
    >
      <CarouselContent>
        {slides.map((slide, index) => (
          <CarouselItem key={index}>
            <div className="text-gray-200 max-w-2xl  px-6 rounded-md h-full flex flex-col justify-center">
              <h1 className="text-4xl md:text-6xl font-extrabold leading-tight">
                {slide.title}{" "}
                <span className="text-white bg-primary px-3 rounded-md font-semibold shadow-amber-500/50 shadow-md">
                  {slide.highlight}
                </span>
                <br />
                {slide.subtitle}
              </h1>

              <div className="mt-6">
                <p className="uppercase tracking-widest text-sm opacity-80">
                  {slide.school}
                </p>
                <p className="text-accent font-semibold mt-1">
                  {slide.location}
                </p>
              </div>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
}

const PROGRAMS = {
  college: ["BSIT", "ACT", "BSHM"],
  seniorHigh: ["STEM", "ABM", "HUMSS", "GAS", "ICT", "HE"],
} as const;

type YearRef = "" | keyof typeof PROGRAMS;

function HeroForm() {
  const [yearRef, setYearRef] = React.useState<YearRef>("");
  const [program, setProgram] = React.useState("");
  const [submitState, setSubmitState] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const programOptions: readonly string[] = yearRef ? PROGRAMS[yearRef] : [];

  function handleYearChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const nextYear = e.target.value as YearRef;
    setYearRef(nextYear);
    setProgram("");
    setSubmitState(null);
  }

  function handleProgramChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setProgram(e.target.value);
    setSubmitState(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!yearRef || !program) {
      setSubmitState({
        type: "error",
        message: "Please select both Year Reference and Program.",
      });
      return;
    }

    if (!programOptions.includes(program)) {
      setSubmitState({
        type: "error",
        message: "Please select a valid program for the selected Year Reference.",
      });
      return;
    }

    setSubmitState({
      type: "success",
      message: `Saved selection: ${yearRef === "college" ? "College" : "Senior High School"} - ${program}.`,
    });
  }

  return (
    <div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full mx-auto">
      <h2 className="text-2xl font-bold text-center text-primary">
        TAKE THE FIRST STEP
      </h2>

      <p className="text-sm text-gray-500 text-center mt-2">
        Request information to start on the path to your degree
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <select
          value={yearRef}
          onChange={handleYearChange}
          className="w-full rounded-md border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Year Reference</option>
          <option value="seniorHigh">Senior High School</option>
          <option value="college">College</option>
        </select>

        <select
          value={program}
          onChange={handleProgramChange}
          disabled={!yearRef}
          className="w-full rounded-md border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <option value="">
            {yearRef ? "Programs" : "Select Year Reference first"}
          </option>

          {programOptions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <button
          type="submit"
          disabled={!yearRef || !program}
          className="w-full bg-primary text-white py-3 rounded-md font-semibold transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-primary"
        >
          Submit
        </button>
      </form>

      {submitState && (
        <p
          role="status"
          className={`mt-3 text-center text-xs ${submitState.type === "error" ? "text-red-600" : "text-green-700"}`}
        >
          {submitState.message}
        </p>
      )}

      <p className="text-xs text-gray-400 text-center mt-4">
        We respect your privacy.
      </p>
    </div>
  );
}

export default function Hero() {
  return (
    <section className="relative h-5/6 w-full overflow-hidden">
      {/* Background */}
      <div
        className="fixed -z-10 top-10 inset-0 bg-cover bg-center max-w-screen"
        style={{ backgroundImage: "url('https://res.cloudinary.com/dghjtnxjw/image/upload/v1772361480/uploads/obfeeocicbq2qm95osmn.png')" }}
      />
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs max-w-screen" />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-7xl px-6 py-10 lg:py-20 ">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-center">
          <div className="lg:col-span-2">
            <HeroCarousel />
          </div>

          <div className="lg:col-span-1">
            <HeroForm />
          </div>
        </div>
      </div>
    </section>
  );
}
