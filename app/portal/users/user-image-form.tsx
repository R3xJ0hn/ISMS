"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Save } from "lucide-react";
import { ProfileImageField } from "@/components/portal/profile-image-field";
import { usePortalFormFeedback } from "@/components/portal/toasts";
import { Button } from "@/components/ui/button";
import type { ManagedUser, UserImageFormState } from "@/lib/users/admin";
import { formatRoleLabel } from "@/lib/utils";
import { updateUserImageAction } from "./actions";

const initialState: UserImageFormState = { success: false, message: "" };

export function UserImageForm({ user }: { user: ManagedUser }) {
  const [state, formAction, pending] = useActionState(updateUserImageAction, initialState);
  const [photoValid, setPhotoValid] = useState(true);
  const formRef = usePortalFormFeedback(state, { returnTo: "/portal/users", refresh: true });
  const disabled = pending || state.success;

  return (
    <form ref={formRef} action={formAction} aria-busy={pending} className="w-full max-w-3xl space-y-6">
      <input type="hidden" name="userId" value={user.id} />
      <div className="grid gap-6 md:grid-cols-2">
        <section aria-labelledby="user-account-heading" className="min-w-0 rounded-lg border border-border bg-card p-5 shadow-sm">
          <h2 id="user-account-heading" className="text-base font-semibold">Account details</h2>
          <dl className="mt-5 space-y-4 text-sm">
            {[["Name", user.name ?? "No linked profile"], ["Email", user.email], ["Role", formatRoleLabel(user.role)], ["Email verification", user.emailVerified ? "Verified" : "Unverified"]].map(([label, value]) => (
              <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 font-medium [overflow-wrap:anywhere]">{value}</dd></div>
            ))}
          </dl>
        </section>
        <ProfileImageField imageUrl={user.userImage} displayName={user.name ?? "User"} disabled={disabled}
          error={state.fieldErrors?.image} onValidityChange={setPhotoValid} />
      </div>
      {state.fieldErrors?.userId && <p role="alert" className="text-sm text-destructive">{state.fieldErrors.userId}</p>}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button asChild variant="outline"><Link href="/portal/users">Cancel</Link></Button>
        <Button type="submit" disabled={disabled || !photoValid}><Save aria-hidden="true" />{pending ? "Saving..." : "Save changes"}</Button>
      </div>
    </form>
  );
}
