"use client";

import * as React from "react";
import Image from "next/image";
import { MapPin, Phone, Facebook, ArrowUpRight } from "lucide-react";

type Branch = {
  id: string;
  code: string;
  title: string;
  image: string | null;
  phone: string | null;
  facebookText: string | null;
  mapLink: string | null;
  formattedAddress: string;
};

type BranchesResponse = {
  branches?: Branch[];
};

type BranchesStatus = "loading" | "success" | "error";

const fallbackBranchImage =
  "https://res.cloudinary.com/dghjtnxjw/image/upload/v1772366051/uploads/ga78teh5pp1tqj9ia0lu.jpg";

function InfoRow({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 text-sm text-neutral-700">
      <span className="mt-0.5 text-neutral-600">{icon}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

const BranchCard = ({ branch }: { branch: Branch }) => (
  <article
    className="
      group
      flex h-35 overflow-hidden rounded-xl border border-neutral-200 bg-white
      shadow-sm
      transition-all duration-300 ease-out
      hover:-translate-y-1 hover:shadow-md
      hover:border-neutral-300
    "
  >
    {/* LEFT IMAGE */}
    <div className="relative h-full w-[44%] shrink-0 overflow-hidden">
      <Image
        src={branch.image ?? fallbackBranchImage}
        alt={branch.title}
        fill
        className="
          object-cover
          transition-transform duration-500 ease-out
          group-hover:scale-[1.06]
        "
        sizes="(max-width: 1024px) 50vw, 25vw"
      />

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
    <div className="flex h-full w-[56%] flex-col px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="line-clamp-1 text-sm font-semibold text-neutral-900">
          {branch.title}
        </h3>

        {/* small icon anim */}
        <ArrowUpRight
          size={16}
          className="
            shrink-0 text-neutral-400
            transition-all duration-300
            group-hover:translate-x-0.5 group-hover:-translate-y-0.5
            group-hover:text-neutral-700
          "
        />
      </div>

      <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2">
        <InfoRow icon={<MapPin size={16} />}>
          {branch.mapLink ? (
            <a
              className="
                line-clamp-2 leading-snug
                transition-colors duration-200
                group-hover:text-neutral-900 hover:underline
              "
              href={branch.mapLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              {branch.formattedAddress || "Address not provided"}
            </a>
          ) : (
            <p className="line-clamp-2 leading-snug">
              {branch.formattedAddress || "Address not provided"}
            </p>
          )}
        </InfoRow>

        <InfoRow icon={<Phone size={16} />}>
          <p className="line-clamp-1">{branch.phone || "Phone not provided"}</p>
        </InfoRow>

        <InfoRow icon={<Facebook size={16} />}>
          <p className="line-clamp-1">
            {branch.facebookText || "Facebook page not provided"}
          </p>
        </InfoRow>
      </div>
    </div>
  </article>
);

export default function Branches() {
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [status, setStatus] = React.useState<BranchesStatus>("loading");

  React.useEffect(() => {
    const controller = new AbortController();

    async function loadBranches() {
      try {
        setStatus("loading");

        const response = await fetch("/api/branches", {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to fetch branches.");
        }

        const data = (await response.json()) as BranchesResponse;

        setBranches(data.branches ?? []);
        setStatus("success");
      } catch {
        if (!controller.signal.aborted) {
          setBranches([]);
          setStatus("error");
        }
      }
    }

    void loadBranches();

    return () => controller.abort();
  }, []);

  return (
    <section className="w-full bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
          School Branches
        </h1>

        {status === "loading" && (
          <p className="mt-6 text-sm text-neutral-600">Loading branches...</p>
        )}

        {status === "error" && (
          <p className="mt-6 text-sm text-red-600">
            Branches are unavailable right now.
          </p>
        )}

        {status === "success" && branches.length === 0 && (
          <p className="mt-6 text-sm text-neutral-600">
            No branches are available yet.
          </p>
        )}

        {status === "success" && branches.length > 0 && (
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {branches.map((branch) => (
              <BranchCard key={branch.id} branch={branch} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
