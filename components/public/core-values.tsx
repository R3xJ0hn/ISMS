// app/(public)/components/CoreValuesSection.tsx
"use client";

import React from "react";
import {
  Crown,
  Award,
  HeartHandshake,
  BadgeCheck,
  ShieldCheck,
  Lightbulb,
  Users,
} from "lucide-react";

type CoreValue = {
  title: string;
  description: string;
  icon: React.ElementType;
};

const coreValues: CoreValue[] = [
  {
    title: "Leadership",
    description:
      "We develop student leaders who inspire, serve, and make responsible decisions in school and beyond.",
    icon: Crown,
  },
  {
    title: "Excellence",
    description:
      "We strive for high standards in learning, teaching, and student performance through continuous growth.",
    icon: Award,
  },
  {
    title: "Respect",
    description:
      "We treat everyone with dignity and fairness, valuing differences and building a safe school community.",
    icon: HeartHandshake,
  },
  {
    title: "Confidence",
    description:
      "We empower students to believe in themselves, communicate boldly, and face challenges with courage.",
    icon: BadgeCheck,
  },
  {
    title: "Responsibility",
    description:
      "We promote accountability doing what’s right, meeting commitments, and caring for our environment.",
    icon: ShieldCheck,
  },
  {
    title: "Innovation",
    description:
      "We encourage creative thinking and modern learning approaches to prepare students for the future.",
    icon: Lightbulb,
  },
  {
    title: "Inclusion",
    description:
      "We welcome everyone and ensure equal opportunities for participation, support, and success.",
    icon: Users,
  },
];

// Theme colors inspired by your header/logo
const THEME = {
  navy: "#1B2A6B",
  gold: "#F4B000",
  maroon: "#7A0F1B",
};

export default function CoreValuesSection() {
  return (
    <section className="relative w-full py-16 md:py-24">
      {/* clean white with a subtle navy tint */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-b from-slate-50 via-white to-white" />

      <div className="mx-auto w-full max-w-7xl px-6">
        {/* Header (mirrors your logo style: navy title + gold accent bar) */}
        <div className="max-w-3xl">
          <div className="flex items-start gap-4">
            <span
              className="mt-1 h-12 w-1.5 rounded-full"
              style={{ backgroundColor: THEME.gold }}
            />
            <div>
              <p
                className="text-sm font-semibold uppercase tracking-wider"
                style={{ color: THEME.maroon }}
              >
                Datamex College of Saint Adeline
              </p>

              <h2
                className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl"
                style={{ color: THEME.navy }}
              >
                Core Values
              </h2>

              <p className="mt-4 text-base leading-relaxed text-slate-600">
                These values guide how we learn, lead, and support one another helping every
                student grow with character and purpose.
              </p>
            </div>
          </div>
        </div>

        {/* Cards */}
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {coreValues.map((item, idx) => {
            const Icon = item.icon;

            // rotate accents for visual variety (navy/gold/maroon)
            const accents = [THEME.navy, THEME.gold, THEME.maroon];
            const accent = accents[idx % accents.length];

            return (
              <article
                key={item.title}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                {/* Accent glow on hover */}
                <div className="pointer-events-none absolute -inset-1 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100">
                  <div
                    className="h-full w-full"
                    style={{
                      background: `linear-gradient(90deg, ${accent}22, #ffffff, ${accent}22)`,
                    }}
                  />
                </div>

                <div className="relative flex items-start gap-4">
                  {/* Icon badge */}
                  <div
                    className="grid h-12 w-12 place-items-center rounded-xl border bg-white transition-all duration-300 group-hover:scale-105"
                    style={{
                      borderColor: `${accent}33`,
                      boxShadow: `0 10px 20px ${accent}14`,
                    }}
                  >
                    <Icon className="h-6 w-6" style={{ color: accent }} />
                  </div>

                  <div className="min-w-0">
                    {/* Readable h3 */}
                    <h3
                      className="text-lg font-bold tracking-tight"
                      style={{ color: THEME.navy }}
                    >
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      {item.description}
                    </p>
                  </div>
                </div>

                {/* Bottom accent line (gold-ish vibe from header) */}
                <div className="relative mt-6 h-px w-full bg-slate-200">
                  <div
                    className="h-px w-0 transition-all duration-300 group-hover:w-2/3"
                    style={{ backgroundColor: THEME.gold }}
                  />
                </div>
              </article>
            );
          })}
        </div>

      </div>
    </section>
  );
}