import { requireSession } from "@/lib/auth"
import { studentNeedsAdmissionReview } from "@/lib/admission/student-review"
import { UserRole } from "@/lib/generated/prisma/enums"
import { portalTheme } from "@/lib/portal/theme"
import { redirect } from "next/navigation"

export default async function Page() {
  const session = await requireSession()

  if (session.role === UserRole.student) {
    if (await studentNeedsAdmissionReview(session.email)) {
      redirect("/portal/admission-review")
    }
    redirect("/portal/classroom")
  }

  if (session.role === UserRole.teacher) {
    redirect("/portal/my-classes")
  }

  if (session.role === UserRole.admin || session.role === UserRole.superAdmin) {
    redirect("/portal/dashboard")
  }

  return (
    <main style={portalTheme} className="flex flex-1 flex-col gap-3 p-4 md:p-6">
      <h1 className="text-2xl font-semibold">Portal</h1>
      <p className="max-w-xl text-sm text-muted-foreground">You are signed in. Contact your administrator if you need access to school management tools.</p>
    </main>
  );
}
