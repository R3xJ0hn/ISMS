import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PortalPageHeaderProps = {
  label: ReactNode;
  title: string;
  description: string;
  children?: ReactNode;
};

export function PortalPageHeader({ label, title, description, children }: PortalPageHeaderProps) {
  return (
    <section className="flex flex-col gap-2">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        </div>
        {children}
      </div>
    </section>
  );
}

/** Common shell for create, edit and assignment pages. Feature pages retain their own data loading. */
export function PortalFormPage({ label, title, description, backHref, backLabel, headerActions, className, children }:
  PortalPageHeaderProps & { backHref: string; backLabel: string; headerActions?: ReactNode; className?: string }
) {
  return (
    <main className={cn("flex flex-1 flex-col gap-6 p-4 md:p-6", className)}>
      <Button asChild variant="outline" className="w-fit"><Link href={backHref}><ArrowLeft aria-hidden="true" />{backLabel}</Link></Button>
      <PortalPageHeader label={label} title={title} description={description}>{headerActions}</PortalPageHeader>
      {children}
    </main>
  );
}

export function PortalCount({ count, label }: { count: number; label: string }) {
  return (
    <div className="w-fit rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
      <span className="font-semibold text-foreground">{count}</span>{" "}{label}
    </div>
  );
}

export function PortalEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="px-6 py-14 text-center">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
