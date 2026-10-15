"use client";

import { useRef, useState } from "react";
import { BookOpen, Pencil, Plus, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import { normalizeSpreadsheetUrl } from "@/lib/classes/validation";
import { classroomTheme } from "@/lib/portal/theme";
import { cn } from "@/lib/utils";
import { SpreadsheetLinkForm } from "./spreadsheet-link-form";

export function SpreadsheetConnectionCard({ classId, spreadsheetUrl }: { classId: string; spreadsheetUrl: string | null }) {
  const linked = Boolean(spreadsheetUrl && normalizeSpreadsheetUrl(spreadsheetUrl));
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const ActionIcon = linked ? Pencil : Plus;
  const actionLabel = linked ? "Edit Google Sheets link" : "Add Google Sheets link";
  const statusColor = linked ? "text-emerald-700" : "text-red-700";

  function changeOpen(nextOpen: boolean) {
    if (!busy) setOpen(nextOpen);
  }

  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      <section className="flex min-w-0 items-center gap-4 rounded-2xl border border-border bg-card p-5" aria-label="Class spreadsheet connection">
        <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", linked ? "bg-emerald-500/10 text-emerald-700" : "bg-red-500/10 text-red-700")}><BookOpen aria-hidden="true" className="size-5" /></div>
        <div className="min-w-0 flex-1">
          <h2 className={cn("font-semibold", statusColor)}>{linked ? "Spreadsheet connected" : "Spreadsheet not connected"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{linked ? "View student records in the Grades tab." : "Add a Google Sheets link to load grades."}</p>
        </div>
        <Dialog.Trigger asChild>
          <Button ref={triggerRef} type="button" variant="ghost" size="icon" aria-label={actionLabel} title={actionLabel} disabled={busy} className={cn("shrink-0 rounded-full", statusColor, linked ? "hover:bg-emerald-500/10 hover:text-emerald-800" : "hover:bg-red-500/10 hover:text-red-800")}><ActionIcon aria-hidden="true" className="size-5" /></Button>
        </Dialog.Trigger>
      </section>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content style={classroomTheme}
          onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }}
          onInteractOutside={(event) => { if (busy) event.preventDefault(); }}
          onCloseAutoFocus={(event) => { event.preventDefault(); triggerRef.current?.focus(); }}
          className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-xl outline-none sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-semibold">{actionLabel}</Dialog.Title>
              <Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">{linked ? "Update the spreadsheet used for this class's student records and grade summary." : "Connect this class to its student records and grade summary."}</Dialog.Description>
            </div>
            <Dialog.Close asChild><Button type="button" variant="ghost" size="icon-sm" aria-label="Close spreadsheet dialog" disabled={busy} className="shrink-0"><X aria-hidden="true" /></Button></Dialog.Close>
          </div>
          <SpreadsheetLinkForm classId={classId} spreadsheetUrl={spreadsheetUrl} onCancel={() => changeOpen(false)} onPendingChange={setBusy} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
