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

/**
 * Retrieve a string value for a given key from FormData, returning an empty string if the key is absent or the value is not a string.
 *
 * @param formData - The FormData to read from
 * @param key - The form field name to retrieve
 * @returns The field value as a string, or an empty string if missing or not a string
 */
function readFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/**
 * Handle a login form submission by validating input, authenticating the user, creating a session, and redirecting on success.
 *
 * @param _previousState - Previous form state (ignored).
 * @param formData - Submitted form data; expected keys: `"email"`, `"password"`, and optional `"rememberMe"` set to `"on"`.
 * @returns A `LoginFormState` with `status: "error"`, an explanatory `message`, and the provided `email` when validation or authentication fails. On successful authentication a session is created and the user is redirected to `/portal`.
 */
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

/**
 * Clears the current user session and redirects the client to the login page.
 */
export async function logoutAction() {
  await clearSession();
  redirect("/login");
}
