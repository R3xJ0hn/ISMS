import { JWTPayload } from "jose";
import { UserRole } from "../generated/prisma/enums";

export type SessionUser = {
  id: string;
  email: string;
  role: UserRole;
  emailVerified: boolean;
};

export type SessionTokenPayload = JWTPayload & {
  email: string;
  role: UserRole;
  emailVerified: boolean;
};

export type UpdatePasswordRecord = {
  token: string;
  studentId: string;
  displayName: string;
  email: string;
};

export type SetPasswordInput = {
  password: string;
  confirmPassword: string;
};