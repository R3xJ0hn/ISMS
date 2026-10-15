import { Suspense, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { MapPin, Phone, Facebook, ArrowUpRight } from "lucide-react";

import { getAdmissionBranches } from "@/lib/admission/catalog";
import type { AdmissionBranch } from "@/lib/types/admission";
import { cn } from "@/lib/utils";

function externalLink(value: string | null) {
  if (!value) return null;

  try {
    const url = new URL(value.trim());
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function phoneLink(value: string | null) {
  const phone = value?.trim();
  if (!phone || !/^\+?[\d\s().-]+$/.test(phone)) return null;

  const number = phone.replace(/[^\d+]/g, "");
  return /^\+?\d{3,15}$/.test(number) ? `tel:${number}` : null;
}

function InfoRow({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 text-sm text-neutral-700">
      <span className="mt-0.5 text-neutral-600">{icon}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function BranchCard({
  branch,
  expanded = false,
}: {
  branch: AdmissionBranch;
  expanded?: boolean;
}) {
  const mapHref = externalLink(branch.mapLink);
  const facebookHref = externalLink(branch.facebookText);
  const telephoneHref = phoneLink(branch.phone);

  return (
    <article
      className={cn(
        "group flex overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:border-neutral-300 hover:shadow-md",
        expanded ? "h-full flex-col" : "h-35"
      )}
    >
      {/* LEFT IMAGE */}
      <div className={cn("relative shrink-0 overflow-hidden", expanded ? "h-48 w-full" : "h-full w-[44%]")}>
        {branch.image ? (
          <Image
            src={branch.image}
            alt={branch.title}
            fill
            className="
              object-cover
              transition-transform duration-500 ease-out
              group-hover:scale-[1.06]
            "
            sizes={expanded ? "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" : "(max-width: 1024px) 50vw, 25vw"}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-neutral-100 text-neutral-400">
            <MapPin size={24} aria-hidden="true" />
          </div>
        )}

        {/* subtle overlay on hover */}
        <div
          className="
            pointer-events-none absolute inset-0
            bg-black/0 transition-colors duration-300
            group-hover:bg-black/10
          "
        />
      </div>

      {/* RIGHT CONTENT */}
      <div className={cn("flex min-w-0 flex-col", expanded ? "flex-1 p-5" : "h-full w-[56%] px-4 py-3")}>
        <div className="flex items-center justify-between gap-2">
          <h3 className={cn("min-w-0 font-semibold text-neutral-900", expanded ? "text-lg [overflow-wrap:anywhere]" : "line-clamp-1 text-sm")}>
            {branch.title}
          </h3>

          {mapHref && (
            <a href={mapHref} target="_blank" rel="noopener noreferrer" aria-label={`View ${branch.title} on map`} className="shrink-0 text-neutral-400 transition-colors hover:text-primary">
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          )}
        </div>

        <div className={cn("flex min-h-0 flex-1 flex-col", expanded ? "mt-4 gap-3" : "mt-2 gap-2")}>
          <InfoRow icon={<MapPin size={16} aria-hidden="true" />}>
            {mapHref ? (
              <a
                className={cn("break-words leading-snug transition-colors duration-200 hover:text-primary hover:underline", !expanded && "line-clamp-2")}
                href={mapHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                {branch.formattedAddress || "Address not provided"}
              </a>
            ) : (
              <p className={cn("break-words leading-snug", !expanded && "line-clamp-2")}>
                {branch.formattedAddress || "Address not provided"}
              </p>
            )}
          </InfoRow>

          <InfoRow icon={<Phone size={16} aria-hidden="true" />}>
            {telephoneHref ? (
              <a href={telephoneHref} className={cn("break-words hover:text-primary hover:underline", !expanded && "line-clamp-1")}>{branch.phone}</a>
            ) : (
              <p className={cn("break-words", !expanded && "line-clamp-1")}>{branch.phone || "Phone not provided"}</p>
            )}
          </InfoRow>

          <InfoRow icon={<Facebook size={16} aria-hidden="true" />}>
            {facebookHref ? (
              <a href={facebookHref} target="_blank" rel="noopener noreferrer" className="hover:text-primary hover:underline">Facebook page</a>
            ) : (
              <p className={cn("break-words", !expanded && "line-clamp-1")}>
                {branch.facebookText || "Facebook page not provided"}
              </p>
            )}
          </InfoRow>
        </div>
      </div>
    </article>
  );
}

async function BranchList() {
  await connection();
  const { branches, error } = await getAdmissionBranches();

  if (error) {
    return <p className="mt-6 text-sm text-red-600">Branches are unavailable right now.</p>;
  }

  if (branches.length === 0) {
    return <p className="mt-6 text-sm text-neutral-600">No branches are available yet.</p>;
  }

  return (
    <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {branches.map((branch) => <BranchCard key={branch.id} branch={branch} />)}
    </div>
  );
}

export default function Branches() {
  return (
    <section className="w-full bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
            School Branches
          </h1>
          <Link href="/branches" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            View all branches <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>

        <Suspense fallback={<p className="mt-6 text-sm text-neutral-600">Loading branches...</p>}>
          <BranchList />
        </Suspense>
      </div>
    </section>
  );
}
