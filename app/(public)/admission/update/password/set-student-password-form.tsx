"use client";

import { PasswordSetupForm } from "@/components/auth/password-setup-form";
import type { StudentUpdatePasswordRecord } from "@/lib/types";

import {
  setStudentPortalPassword,
  type SetStudentPasswordFormState,
} from "../actions";

const initialState: SetStudentPasswordFormState = {
  status: "idle",
  message: "",
};

export default function SetStudentPasswordForm({
  student,
}: {
  student: StudentUpdatePasswordRecord;
}) {
  return (
    <PasswordSetupForm
      action={setStudentPortalPassword}
      initialState={initialState}
      hiddenFields={[{ name: "token", value: student.token }]}
      eyebrow="Portal access"
      title="Create your portal password"
      description={
        <>
          Use this password with {student.email} when signing in to
          MyDCSAePortal.
        </>
      }
      account={{ name: student.displayName, email: student.email }}
      submitLabel="Set password"
      pendingLabel="Saving..."
    />
  );
}
