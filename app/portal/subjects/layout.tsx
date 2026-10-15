import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Manage Subjects",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function SubjectsLayout({ children }: { children: ReactNode }) {
  return children;
}
