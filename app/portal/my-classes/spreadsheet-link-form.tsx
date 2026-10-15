"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TeacherSpreadsheetFormState } from "@/lib/classes/validation";
import { useActionToast } from "@/components/portal/toasts";
import { saveClassSpreadsheetAction } from "./actions";

const initialState: TeacherSpreadsheetFormState = { success: false, message: "" };

export function SpreadsheetLinkForm({ classId, spreadsheetUrl, onCancel, onPendingChange }: {
  classId: string;
  spreadsheetUrl: string | null;
  onCancel?: () => void;
  onPendingChange?: (busy: boolean) => void;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(spreadsheetUrl ?? "");
  const [state, formAction, pending] = useActionState(saveClassSpreadsheetAction, initialState);
  useActionToast(state);
  const error = state.fieldErrors?.spreadsheetUrl;

  useEffect(() => {
    onPendingChange?.(pending || state.success);
    if (!state.success) return;
    router.push("/portal/my-classes");
    router.refresh();
  }, [state, router, pending, onPendingChange]);

  return (
    <form action={formAction} onSubmit={() => onPendingChange?.(true)} aria-busy={pending} className="min-w-0">
      <input type="hidden" name="classId" value={classId} />
      <fieldset disabled={pending || state.success} className="min-w-0 space-y-4">
        <div className="space-y-2">
          <label htmlFor="class-spreadsheet-url" className="block text-sm font-medium">Google Sheets link <span className="text-destructive">*</span></label>
          <Input
            id="class-spreadsheet-url" name="spreadsheetUrl" type="url" value={url} onChange={(event) => setUrl(event.target.value)}
            required autoFocus maxLength={2048} autoComplete="off" placeholder="https://docs.google.com/spreadsheets/d/.../edit"
            aria-invalid={Boolean(error)} aria-describedby={["class-spreadsheet-url-help", error ? "class-spreadsheet-url-error" : ""].filter(Boolean).join(" ")}
          />
          <p id="class-spreadsheet-url-help" className="text-xs leading-5 text-muted-foreground">Paste the Google Sheets link for this class to load its student records and grade summary. You can update the link here at any time.</p>
          {error && <p id="class-spreadsheet-url-error" className="text-sm text-destructive">{error}</p>}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
          {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
          <Button type="submit"><Save aria-hidden="true" />{pending ? "Saving..." : spreadsheetUrl ? "Update link" : "Save link"}</Button>
        </div>
      </fieldset>
    </form>
  );
}
