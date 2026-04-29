import { getCurrentSession } from "@/lib/auth"
import { UserRole } from "@/lib/generated/prisma/enums"
import { portalTheme } from "@/lib/portal/theme"
import { redirect } from "next/navigation"

export default async function Page() {
  const session = await getCurrentSession()

  if (!session) {
    redirect("/login")
  }

  if (session.role === UserRole.student) {
    redirect("/portal/grades")
  }

  return (
    <div style={portalTheme} className="flex flex-1 flex-col gap-4 p-4 pt-4 md:p-6">
      <div className="grid auto-rows-min gap-4 md:grid-cols-3">
        <div className="aspect-video rounded-2xl border border-border bg-card shadow-sm" />
        <div className="aspect-video rounded-2xl border border-border bg-card shadow-sm" />
        <div className="aspect-video rounded-2xl border border-border bg-card shadow-sm" />
      </div>
      <div className="min-h-screen flex-1 rounded-3xl border border-border bg-card shadow-sm md:min-h-min" />
    </div>
  );
}
