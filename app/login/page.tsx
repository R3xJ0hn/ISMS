import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, LockKeyhole, UserRound } from "lucide-react";

export const metadata: Metadata = {
  title: "Login | MyDCSAePortal",
  description: "Sign in page for MyDCSAePortal.",
};

export default function LoginPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f8f4ea] text-[#17133c]">
      <section className="relative grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">

        <div className="relative hidden bg-primary text-white lg:block">
          <Image
            src="https://res.cloudinary.com/dghjtnxjw/image/upload/v1772362161/uploads/uzmj1kgeurubodkbxpu4.jpg"
            alt="Datamex College of Saint Adeline campus"
            fill
            className="object-cover opacity-35"
            sizes="52vw"
            priority
          />
          <div className="absolute inset-0 bg-linear-to-br from-primary via-primary/85 to-primary/10" />
          <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
            <Link
              href="/"
              className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-white/85 transition hover:text-white"
            >
              <ArrowLeft className="size-4" />
              Back to website
            </Link>

            <div className="max-w-xl">
              <div className="mb-8 flex items-center gap-4">
                <Image
                  src="https://res.cloudinary.com/dghjtnxjw/image/upload/v1772363064/uploads/czeccbdle54njfottdz1.png"
                  alt="Datamex College of Saint Adeline logo"
                  width={72}
                  height={72}
                  className="rounded-full bg-white p-2"
                  priority
                />
                <div>
                  <p className="text-2xl font-black tracking-tight mb-3">DATAMEX</p>
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-accent">
                    College of Saint Adeline
                  </p>
                </div>
              </div>


              <h1 className="mt-20 text-xl font-black leading-tight tracking-tight xl:text-5xl">
                Student access starts here.
              </h1>
              <p className="mt-6 text-white/82 ">
                Sign in to continue to the Datamex College of Saint Adeline
                student information management system.
              </p>
            </div>

            <p className="text-sm text-white/80">
              For account concerns, contact the registrar office.
            </p>
          </div>
        </div>

        <div className="relative flex items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-md">
            <Link
              href="/"
              className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-primary transition hover:text-secondary lg:hidden"
            >
              <ArrowLeft className="size-4" />
              Back to website
            </Link>

            <div className="rounded-xl border border-white/80 bg-white/90 p-6 shadow-2xl shadow-primary/10 backdrop-blur sm:p-8">
              <div className="mb-8 text-center">
                <div className="mx-auto mb-5 grid size-20 place-items-center rounded-md bg-primary">
                  <Image
                    src="https://res.cloudinary.com/dghjtnxjw/image/upload/v1772363064/uploads/czeccbdle54njfottdz1.png"
                    alt="Datamex College of Saint Adeline logo"
                    width={56}
                    height={56}
                    className="rounded-full bg-white p-2"
                    priority
                  />
                </div>
  
                <h2 className="mt-3 text-xl font-black tracking-tight">
                  Welcome back
                </h2>
                <p className=" text-sm leading-6 text-gray-500">
                  Enter your portal credentials to continue.
                </p>
              </div>

              <form className="space-y-5">
                <label className="block">
                  <span className="text-sm font-bold text-gray-700">
                   Email
                  </span>
                  <span className="mt-2 flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
                    <UserRound className="size-5 text-gray-400" />
                    <input
                      type="text"
                      name="identifier"
                      autoComplete="username"
                      placeholder="Enter your account"
                      className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
                    />
                  </span>
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-gray-700">
                    Password
                  </span>
                  <span className="mt-2 flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
                    <LockKeyhole className="size-5 text-gray-400" />
                    <input
                      type="password"
                      name="password"
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
                    />
                  </span>
                </label>

                <div className="flex items-center justify-between gap-4 text-sm">
                  <label className="flex items-center gap-2 text-gray-600">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-gray-300 accent-primary"
                    />
                    Remember me
                  </label>
                  <a className="font-semibold text-secondary" href="mailto:datamex_registrar@stadeline.edu.ph">
                    Need help?
                  </a>
                </div>

                <button
                  type="button"
                  className="w-full rounded-2xl bg-secondary px-5 py-3.5 text-sm font-black uppercase tracking-[0.18em] text-white shadow-lg shadow-secondary/20 transition hover:-translate-y-0.5 hover:bg-primary"
                >
                  Sign in
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
