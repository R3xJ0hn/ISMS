"use server";

import { redirect } from "next/navigation";

import { authenticateUser, clearSession, createSession } from "@/lib/auth";

export type LoginFormState = {
  status: "idle" | "error";
  message: string;
  email: string;
};

const initialState: LoginFormState = {
  status: "idle",
  message: "",
  email: "",
};

function readFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function loginAction(
  _previousState: LoginFormState = initialState,
  formData: FormData
): Promise<LoginFormState> {
  void _previousState;

  const email = readFormValue(formData, "email").trim();
  const password = readFormValue(formData, "password");
  const remember = formData.get("rememberMe") === "on";

  if (!email || !password) {
    return {
      status: "error",
      message: "Email and password are required.",
      email,
    };
  }

  const result = await authenticateUser(email, password);

  if (!result.success) {
    return {
      status: "error",
      message: result.message,
      email,
    };
  }

  await createSession(result.user, { remember });

  redirect("/portal");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}
