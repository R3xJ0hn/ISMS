"use client";

import type { ReactNode } from "react";
import { Tabs } from "radix-ui";

const triggerClassName = "relative shrink-0 border-b-2 border-transparent px-5 py-4 text-sm font-medium text-muted-foreground transition hover:bg-muted/50 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring data-[state=active]:border-primary data-[state=active]:text-primary";

export function WorkspaceTabs({ overview, classwork, students, grades, defaultTab = "overview" }: {
  overview: ReactNode;
  classwork?: ReactNode;
  students?: ReactNode;
  grades: ReactNode;
  defaultTab?: "overview" | "classwork" | "students" | "grades";
}) {
  const tabs = [{ value: "overview", label: "Overview", content: overview },
    ...(classwork !== undefined ? [{ value: "classwork", label: "Classwork", content: classwork }] : []),
    ...(students !== undefined ? [{ value: "students", label: "Students", content: students }] : []),
    { value: "grades", label: "Grades", content: grades }];
  return (
    <Tabs.Root defaultValue={tabs.some((tab) => tab.value === defaultTab) ? defaultTab : "overview"} className="min-w-0">
      <Tabs.List aria-label="Class workspace" className="sticky top-16 z-20 mb-6 flex overflow-x-auto border-b border-border bg-background">
        {tabs.map(({ value, label }) => <Tabs.Trigger key={value} value={value} className={triggerClassName}>{label}</Tabs.Trigger>)}
      </Tabs.List>
      {tabs.map(({ value, content }) => <Tabs.Content key={value} value={value} className="min-w-0 space-y-6 outline-none focus-visible:ring-2 focus-visible:ring-ring">{content}</Tabs.Content>)}
    </Tabs.Root>
  );
}
