"use client";

import { useActionState, useId, useState, type ReactNode } from "react";
import { Search, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePortalFormFeedback } from "./toasts";

type AssignmentState = { success: boolean; message: string; fieldErrors?: Partial<Record<string, string>> };
export type AssignmentItem = { id: string; label: ReactNode; description?: ReactNode; searchText: string };

/** A searchable assignment list. Hidden inputs preserve selections outside the current search. */
export function PortalAssignmentForm({ action, record, itemsField, items, initialIds, lockedIds = [], singular, plural,
  title, searchPlaceholder, emptyState, returnTo, lockedDescription, clearLabel = "Clear selections",
}: {
  action: (previous: AssignmentState, data: FormData) => Promise<AssignmentState>;
  record: { name: string; id: string };
  itemsField: string;
  items: AssignmentItem[];
  initialIds: string[];
  lockedIds?: string[];
  singular: string;
  plural: string;
  title: string;
  searchPlaceholder: string;
  emptyState: ReactNode;
  returnTo: string;
  lockedDescription?: string;
  clearLabel?: string;
}) {
  const searchId = useId();
  const errorId = useId();
  const locked = new Set(lockedIds);
  const [selectedIds, setSelectedIds] = useState(() => new Set([...initialIds, ...lockedIds]));
  const [query, setQuery] = useState("");
  const [state, formAction, pending] = useActionState(action, { success: false, message: "" });
  const formRef = usePortalFormFeedback(state, { returnTo });
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const visibleItems = items.filter((item) => terms.every((term) => item.searchText.toLowerCase().includes(term)));

  function toggleItem(id: string, checked: boolean) {
    if (locked.has(id)) return;
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }

  return (
    <form ref={formRef} action={formAction} aria-busy={pending} className="min-w-0 rounded-lg border border-border bg-card p-4 sm:p-6">
      <input type="hidden" name={record.name} value={record.id} />
      <fieldset disabled={pending || state.success} className="min-w-0 space-y-5" aria-describedby={state.fieldErrors?.[itemsField] ? errorId : undefined}>
        <legend className="mb-4 text-base font-semibold">{title}</legend>
        <input type="hidden" name={itemsField} value="" />
        {[...selectedIds].map((id) => <input key={id} type="hidden" name={itemsField} value={id} />)}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full sm:max-w-sm">
            <label htmlFor={searchId} className="sr-only">Search available {plural}</label>
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id={searchId} role="searchbox" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchPlaceholder} className="pl-9 pr-10" />
            {query && <Button type="button" variant="ghost" size="icon-sm" aria-label={`Clear ${singular} search`} className="absolute right-1 top-1/2 -translate-y-1/2" onClick={() => setQuery("")}><X aria-hidden="true" /></Button>}
          </div>
          <p role="status" className="text-sm text-muted-foreground">{selectedIds.size} selected</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setSelectedIds(new Set([...items.map((item) => item.id), ...lockedIds]))}>Select all</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setSelectedIds(new Set(lockedIds))}>{clearLabel}</Button>
        </div>
        {lockedIds.length > 0 && lockedDescription && <p className="text-sm text-muted-foreground">{lockedDescription}</p>}
        {state.fieldErrors?.[itemsField] && <p id={errorId} className="text-sm text-destructive">{state.fieldErrors[itemsField]}</p>}
        {state.fieldErrors?.[record.name] && <p role="alert" className="text-sm text-destructive">{state.fieldErrors[record.name]}</p>}
        <div className="divide-y divide-border rounded-lg border border-border">
          {visibleItems.map((item) => {
            const used = locked.has(item.id);
            return <label key={item.id} className={`flex items-start gap-3 p-4 ${used ? "cursor-default bg-muted/20" : "cursor-pointer hover:bg-muted/30"}`}>
              <input type="checkbox" checked={selectedIds.has(item.id)} disabled={used} onChange={(event) => toggleItem(item.id, event.target.checked)} className="mt-1 size-4 shrink-0 accent-primary" />
              <span className="min-w-0"><span className="block break-words text-sm font-medium">{item.label}</span>{item.description}{used && <span className="mt-1 block text-xs text-muted-foreground">Used by classes</span>}</span>
            </label>;
          })}
          {!visibleItems.length && <p className="p-6 text-sm text-muted-foreground">{items.length ? `No ${plural} match your search. Existing selections are kept.` : emptyState}</p>}
        </div>
        <div className="flex justify-end border-t border-border pt-5"><Button type="submit"><Save aria-hidden="true" />{pending ? "Saving..." : `Save ${plural}`}</Button></div>
      </fieldset>
    </form>
  );
}
