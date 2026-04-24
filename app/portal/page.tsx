import type { Metadata } from "next";
import { ShieldCheck, UserCircle2 } from "lucide-react";
import { redirect } from "next/navigation";

import { logoutAction } from "@/app/login/actions";
import { formatRoleLabel, getCurrentSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Portal | MyDCSAePortal",
  description: "Protected portal home for authenticated users.",
};

export default async function PortalPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-[#f7f3e8] px-5 py-10 text-[#17133c] sm:px-8 lg:px-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <section className="overflow-hidden rounded-4xl border border-white/80 bg-white shadow-xl shadow-primary/10">
          <div className="border-b border-[#ece5d7] bg-linear-to-r from-primary via-primary/90 to-secondary px-6 py-8 text-white sm:px-8">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/70">
              JWT authenticated
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              Welcome to the portal
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80 sm:text-base">
              Your session is stored in an HTTP-only cookie signed with JWT, and your
              password is verified with bcrypt before access is granted.
            </p>
          </div>

          <div className="grid gap-5 px-6 py-6 sm:px-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-3xl border border-[#ece5d7] bg-[#fbf8f1] p-6">
              <div className="flex items-start gap-4">
                <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary text-white">
                  <UserCircle2 className="size-7" />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">
                    Signed in account
                  </p>
                  <p className="text-2xl font-black tracking-tight text-primary">
                    {session.email}
                  </p>
                  <p className="text-sm text-gray-600">
                    Role: <span className="font-semibold text-gray-900">{formatRoleLabel(session.role)}</span>
                  </p>
                </div>
              </div>

              <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-[#ece5d7] bg-white p-4">
                  <dt className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500">
                    User ID
                  </dt>
                  <dd className="mt-2 text-lg font-bold text-primary">{session.id}</dd>
                </div>
                <div className="rounded-2xl border border-[#ece5d7] bg-white p-4">
                  <dt className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500">
                    Email status
                  </dt>
                  <dd className="mt-2 text-lg font-bold text-primary">
                    {session.emailVerified ? "Verified" : "Not verified"}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-3xl border border-[#ece5d7] bg-[#fffdf8] p-6">
              <div className="flex items-center gap-3 text-primary">
                <ShieldCheck className="size-6" />
                <h2 className="text-lg font-black tracking-tight">Session controls</h2>
              </div>

              <p className="mt-3 text-sm leading-6 text-gray-600">
                This is the simplest protected page in the app. If you add more portal
                routes later, move the session check into a shared portal layout or
                middleware.
              </p>

              <form action={logoutAction} className="mt-6">
                <Button
                  type="submit"
                  className="h-11 w-full rounded-2xl bg-secondary text-sm font-black uppercase tracking-[0.18em] text-white hover:bg-primary"
                >
                  Sign out
                </Button>
              </form>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}