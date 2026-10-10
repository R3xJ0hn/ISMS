"use server";

import { redirect } from "next/navigation";

import { setStudentPortalPasswordFromToken } from "@/lib/admission/student-password-reset";
import {
  studentUpdateFields,
  updateStudentRecordFromToken,
  type UpdateStudentRecordInput,
} from "@/lib/admission/student-update";

export type UpdateStudentFormState = {
  status: "idle" | "success" | "error";
  message: string;
};

export type SetStudentPasswordFormState = {
  status: "idle" | "error";
  message: string;
};

const initialState: UpdateStudentFormState = {
  status: "idle",
  message: "",
};

const passwordInitialState: SetStudentPasswordFormState = {
  status: "idle",
  message: "",
};

function readFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function updateStudentInformation(
  _previousState: UpdateStudentFormState = initialState,
  formData: FormData
): Promise<UpdateStudentFormState> {
  void _previousState;

  const tokenValue = formData.get("token");
  const token = typeof tokenValue === "string" ? tokenValue : "";

  if (!token) {
    return {
      status: "error",
      message: "This update link is invalid or has expired.",
    };
  }

  const input = Object.fromEntries(
    studentUpdateFields.map((field) => [field, readFormValue(formData, field)])
  ) as UpdateStudentRecordInput;
  const result = await updateStudentRecordFromToken(token, input);

  if (result.success) {
    redirect(`/admission/update/password?token=${encodeURIComponent(token)}`);
  }

  return {
    status: "error",
    message: result.message,
  };
}

export async function setStudentPortalPassword(
  _previousState: SetStudentPasswordFormState = passwordInitialState,
  formData: FormData
): Promise<SetStudentPasswordFormState> {
  void _previousState;

  const tokenValue = formData.get("token");
  const token = typeof tokenValue === "string" ? tokenValue : "";

  if (!token) {
    return {
      status: "error",
      message: "This password setup link is invalid or has expired.",
    };
  }

  const result = await setStudentPortalPasswordFromToken(token, {
    password: readFormValue(formData, "password"),
    confirmPassword: readFormValue(formData, "confirmPassword"),
  });

  if (result.success) {
    redirect("/login");
  }

  return {
    status: "error",
    message: result.message,
  };
}
