"use server";

import { saveStudentAdmissionReview, type StudentAdmissionReviewState } from "@/lib/admission/student-review";

export async function saveStudentAdmissionReviewAction(
  _previousState: StudentAdmissionReviewState,
  formData: FormData,
): Promise<StudentAdmissionReviewState> {
  return saveStudentAdmissionReview(formData);
}
