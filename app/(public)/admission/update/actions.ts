"use server";

import { redirect } from "next/navigation";

import {
  setStudentPortalPasswordFromToken,
} from "@/lib/admission/student-password-reset";
import { updateStudentRecordFromToken } from "@/lib/admission/student-update";
import type {
  SetStudentPasswordFormState,
  SetStudentPasswordInput,
  UpdateStudentFormState,
  UpdateStudentRecordInput,
} from "@/lib/admission/types";

const initialState: UpdateStudentFormState = {
  status: "idle",
  message: "",
};

const passwordInitialState: SetStudentPasswordFormState = {
  status: "idle",
  message: "",
};

function readFormValue(formData: FormData, key: keyof UpdateStudentRecordInput) {
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

  const result = await updateStudentRecordFromToken(token, {
    firstName: readFormValue(formData, "firstName"),
    lastName: readFormValue(formData, "lastName"),
    middleName: readFormValue(formData, "middleName"),
    suffix: readFormValue(formData, "suffix"),
    birthDate: readFormValue(formData, "birthDate"),
    gender: readFormValue(formData, "gender"),
    civilStatus: readFormValue(formData, "civilStatus"),
    citizenship: readFormValue(formData, "citizenship"),
    birthplace: readFormValue(formData, "birthplace"),
    religion: readFormValue(formData, "religion"),
    email: readFormValue(formData, "email"),
    phone: readFormValue(formData, "phone"),
    facebookAccount: readFormValue(formData, "facebookAccount"),
    addressHouseNumber: readFormValue(formData, "addressHouseNumber"),
    addressSubdivision: readFormValue(formData, "addressSubdivision"),
    addressStreet: readFormValue(formData, "addressStreet"),
    addressBarangay: readFormValue(formData, "addressBarangay"),
    addressCity: readFormValue(formData, "addressCity"),
    addressProvince: readFormValue(formData, "addressProvince"),
    addressPostalCode: readFormValue(formData, "addressPostalCode"),
    guardianFirstName: readFormValue(formData, "guardianFirstName"),
    guardianLastName: readFormValue(formData, "guardianLastName"),
    guardianMiddleName: readFormValue(formData, "guardianMiddleName"),
    guardianSuffix: readFormValue(formData, "guardianSuffix"),
    guardianRelationship: readFormValue(formData, "guardianRelationship"),
    guardianContactNumber: readFormValue(formData, "guardianContactNumber"),
    guardianOccupation: readFormValue(formData, "guardianOccupation"),
    lastSchoolName: readFormValue(formData, "lastSchoolName"),
    lastSchoolId: readFormValue(formData, "lastSchoolId"),
    lastSchoolShortName: readFormValue(formData, "lastSchoolShortName"),
    lastSchoolType: readFormValue(formData, "lastSchoolType"),
    lastSchoolHouseNumber: readFormValue(formData, "lastSchoolHouseNumber"),
    lastSchoolSubdivision: readFormValue(formData, "lastSchoolSubdivision"),
    lastSchoolStreet: readFormValue(formData, "lastSchoolStreet"),
    lastSchoolBarangay: readFormValue(formData, "lastSchoolBarangay"),
    lastSchoolCity: readFormValue(formData, "lastSchoolCity"),
    lastSchoolProvince: readFormValue(formData, "lastSchoolProvince"),
    lastSchoolPostalCode: readFormValue(formData, "lastSchoolPostalCode"),
    lastSchoolYear: readFormValue(formData, "lastSchoolYear"),
    lastSchoolGraduationDate: readFormValue(formData, "lastSchoolGraduationDate"),
    lastSchoolYearLevel: readFormValue(formData, "lastSchoolYearLevel"),
  });

  if (result.success) {
    redirect(`/admission/update/password?token=${encodeURIComponent(token)}`);
  }

  return {
    status: "error",
    message: result.message,
  };
}

function readPasswordFormValue(
  formData: FormData,
  key: keyof SetStudentPasswordInput
) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
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
    password: readPasswordFormValue(formData, "password"),
    confirmPassword: readPasswordFormValue(formData, "confirmPassword"),
  });

  if (result.success) {
    redirect("/login");
  }

  return {
    status: "error",
    message: result.message,
  };
}
