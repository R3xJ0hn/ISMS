"use client";

import React from "react";
import Image from "next/image";
import { MapPin, Phone, Facebook, ArrowUpRight } from "lucide-react";


const branches = [
  {
    title: "DCSA Meycauayan",
    image: "https://res.cloudinary.com/dghjtnxjw/image/upload/v1772366051/uploads/ga78teh5pp1tqj9ia0lu.jpg",
    location:
      "Datamex bldg., Ngusong Buwaya St., Brgy Saluysoy Meycauayan City Bulacan",
    mapLink: "https://maps.app.goo.gl/AYHnJy3oRhh6HsfC8",
    phone: "(0951) 296-5086",
    facebookLink:
      "https://www.facebook.com/datamexcollegeofstadelinemeycauayan/",
    facebookText: "Datamex Meycauayan",
  },
  {
    title: "DCSA FAIRVIEW",
    image: "https://res.cloudinary.com/dghjtnxjw/image/upload/v1772366137/uploads/yk1t8cek6m4jbtvigw0n.jpg",
    location:
      "85 Fairview Avenue, Commonwealth Avenue East Park Subdivision 1121 Quezon City",
    mapLink: "https://maps.app.goo.gl/q5kxX4BBvuLSn9S19",
    phone: "8921-8350",
    facebookLink: "https://web.facebook.com/CSAFairview",
    facebookText: "Datamex Fairview",
  },
  {
    title: "DCSA CALOOCAN",
    image: "https://res.cloudinary.com/dghjtnxjw/image/upload/v1772366095/uploads/uxw5nxc5etqifsznmmp8.jpg",
    location: "357 J. Teodoro St, Cor 10th Ave, Caloocan",
    mapLink: "https://maps.app.goo.gl/DRcrQ8X3xjmjWKRV7",
    phone: "8366-1970",
    facebookLink:
      "https://web.facebook.com/datamexcollegeofsaintadelinecaloocan",
    facebookText: "Datamex CALOOCAN",
  },
  {
    title: "DCSA VALENZUELA",
    image: "https://res.cloudinary.com/dghjtnxjw/image/upload/v1772366252/uploads/u6bhsqs8w9lgiuhrjfyf.jpg",
    location: "32 GOTACO BLD II MCARTHUR HIGHWAY MARULAS Valenzuela",
    mapLink: "https://maps.app.goo.gl/1zscBSdHvqhB5dPE6",
    phone: "8292-7536",
    facebookLink:
      "https://web.facebook.com/datamexcollegeofstadelinevalenzuela",
    facebookText: "Datamex Valenzuela",
  },
];
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

const BranchCard = ({ branch }: { branch: (typeof branches)[number] }) => (
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
        src={branch.image}
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
            {branch.location}
          </a>
        </InfoRow>

        <InfoRow icon={<Phone size={16} />}>
          <p className="line-clamp-1">{branch.phone}</p>
        </InfoRow>

        <InfoRow icon={<Facebook size={16} />}>
          <a
            className="
              line-clamp-1
              transition-colors duration-200
              group-hover:text-neutral-900 hover:underline
            "
            href={branch.facebookLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            {branch.facebookText}
          </a>
        </InfoRow>
      </div>
    </div>
  </article>
);

const Branches = () => (
  <section className="w-full bg-background">
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
        School Branches
      </h1>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {branches.map((branch, index) => (
          <BranchCard key={index} branch={branch} />
        ))}
      </div>
    </div>
  </section>
);

export default Branches;
