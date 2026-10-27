"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TeacherSpreadsheetFormState, TeacherSpreadsheetRemovalFormState } from "@/lib/classes/validation";
import { useActionToast } from "@/components/portal/toasts";
import { removeClassSpreadsheetAction, saveClassSpreadsheetAction } from "./actions";

const initialState: TeacherSpreadsheetFormState = { success: false, message: "" };

function useSpreadsheetFormFeedback(state: { success: boolean; message: string }, pending: boolean,
  onPendingChange?: (busy: boolean) => void) {
  const router = useRouter();
  useActionToast(state);
  useEffect(() => {
    onPendingChange?.(pending || state.success);
    if (!state.success) return;
    router.push("/portal/my-classes");
    router.refresh();
  }, [state, router, pending, onPendingChange]);
}

export function SpreadsheetLinkForm({ classId, spreadsheetUrl, onCancel, onRemove, onPendingChange, active = true }: {
  classId: string;
  spreadsheetUrl: string | null;
  onCancel?: () => void;
  onRemove?: () => void;
  onPendingChange?: (busy: boolean) => void;
  active?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(spreadsheetUrl ?? "");
  const [state, formAction, pending] = useActionState(saveClassSpreadsheetAction, initialState);
  useSpreadsheetFormFeedback(state, pending, onPendingChange);
  const error = state.fieldErrors?.spreadsheetUrl;

  useEffect(() => {
    if (active) inputRef.current?.focus({ preventScroll: true });
  }, [active]);

  return (
    <form action={formAction} onSubmit={(event) => {
      if (!active || pending || state.success) { event.preventDefault(); return; }
      onPendingChange?.(true);
    }} aria-busy={pending} className="min-w-0">
      <input type="hidden" name="classId" value={classId} />
      <fieldset disabled={!active || pending || state.success} className="min-w-0 space-y-4">
        <div className="space-y-2">
          <label htmlFor="class-spreadsheet-url" className="block text-sm font-medium">Google Sheets link <span className="text-destructive">*</span></label>
          <Input
            ref={inputRef} id="class-spreadsheet-url" name="spreadsheetUrl" type="url" value={url} onChange={(event) => setUrl(event.target.value)}
            required autoFocus maxLength={2048} autoComplete="off" placeholder="https://docs.google.com/spreadsheets/d/.../edit"
            aria-invalid={Boolean(error)} aria-describedby={["class-spreadsheet-url-help", error ? "class-spreadsheet-url-error" : ""].filter(Boolean).join(" ")}
          />
          <p id="class-spreadsheet-url-help" className="text-xs leading-5 text-muted-foreground">Paste the Google Sheets link for this class to load its student records and grade summary. You can update the link here at any time.</p>
          {error && <p id="class-spreadsheet-url-error" className="text-sm text-destructive">{error}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          {spreadsheetUrl && onRemove && <Button type="button" variant="destructive" onClick={onRemove}><Trash2 aria-hidden="true" />Remove link</Button>}
          <div className="ml-auto flex flex-wrap justify-end gap-2">
            {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
            <Button type="submit"><Save aria-hidden="true" />{pending ? "Saving..." : spreadsheetUrl ? "Update link" : "Save link"}</Button>
          </div>
        </div>
      </fieldset>
    </form>
  );
}

const initialRemovalState: TeacherSpreadsheetRemovalFormState = { success: false, message: "" };

export function SpreadsheetRemoveForm({ classId, classCode, spreadsheetUrl, onCancel, onPendingChange, active = true }: {
  classId: string;
  classCode: string;
  spreadsheetUrl: string;
  onCancel: () => void;
  onPendingChange?: (busy: boolean) => void;
  active?: boolean;
}) {
  const confirmationRef = useRef<HTMLInputElement>(null);
  const [confirmation, setConfirmation] = useState("");
  const [state, formAction, pending] = useActionState(removeClassSpreadsheetAction, initialRemovalState);
  useSpreadsheetFormFeedback(state, pending, onPendingChange);
  const expected = `${classCode}/remove-link`;
  const error = state.fieldErrors?.confirmation;
  useEffect(() => {
    if (active) confirmationRef.current?.focus({ preventScroll: true });
  }, [active]);

  return (
    <form action={formAction} onSubmit={(event) => {
      if (!active || pending || state.success || confirmation !== expected) { event.preventDefault(); return; }
      onPendingChange?.(true);
    }} aria-busy={pending} className="min-w-0">
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="expectedSpreadsheetUrl" value={spreadsheetUrl} />
      <fieldset disabled={!active || pending || state.success} className="min-w-0 space-y-4">
        <p className="rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm leading-6">Grades and classwork will be disconnected until you add another spreadsheet link. The Google Sheet itself will be kept.</p>
        <div className="space-y-2">
          <label htmlFor="class-spreadsheet-confirmation" className="block text-sm font-medium">Confirm removal</label>
          <p id="class-spreadsheet-confirmation-help" className="text-sm leading-6 text-muted-foreground">Type <code className="break-all rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">{expected}</code> to remove this class&apos;s spreadsheet link.</p>
          <Input ref={confirmationRef} id="class-spreadsheet-confirmation" name="confirmation" value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)} required maxLength={256} autoComplete="off" autoCapitalize="none" spellCheck={false}
            placeholder={expected} aria-invalid={Boolean(error)}
            aria-describedby={["class-spreadsheet-confirmation-help", error ? "class-spreadsheet-confirmation-error" : ""].filter(Boolean).join(" ")}
          />
          {error && <p id="class-spreadsheet-confirmation-error" className="text-sm text-destructive">{error}</p>}
        </div>
        {(state.fieldErrors?.classId || state.fieldErrors?.expectedSpreadsheetUrl) && <p role="alert" className="text-sm text-destructive">{state.fieldErrors.classId ?? state.fieldErrors.expectedSpreadsheetUrl}</p>}
        <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={onCancel}><ArrowLeft aria-hidden="true" />Back</Button>
          <Button type="submit" variant="destructive" disabled={confirmation !== expected}><Trash2 aria-hidden="true" />{pending ? "Removing..." : "Confirm removal"}</Button>
        </div>
      </fieldset>
    </form>
  );
}
