import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth";

export default async function NewTeacherPage() {
  await requireSuperAdmin();
  redirect("/portal/teachers");
}
