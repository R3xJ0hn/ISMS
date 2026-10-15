import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Manage Employees",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function EmployeesLayout({ children }: { children: ReactNode }) {
  return children;
}
