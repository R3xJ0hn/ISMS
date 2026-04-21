import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-static";
export const revalidate = 300;

type BranchAddress = {
  houseNumber: string | null;
  subdivision: string | null;
  street: string | null;
  barangay: string;
  city: string;
  province: string;
  postalCode: string | null;
};

const branchSelect = {
  id: true,
  slug: true,
  title: true,
  image: true,
  phone: true,
  facebookText: true,
  mapLink: true,
  address: {
    select: {
      houseNumber: true,
      subdivision: true,
      street: true,
      barangay: true,
      city: true,
      province: true,
      postalCode: true,
    },
  },
} as const;

function formatAddress(address: BranchAddress | null) {
  if (!address) {
    return "";
  }

  return [
    address.houseNumber,
    address.street,
    address.subdivision,
    address.barangay,
    address.city,
    address.province,
    address.postalCode,
  ]
    .filter(Boolean)
    .join(", ");
}

export async function GET() {
  try {
    const branches = await prisma.branch.findMany({
      orderBy: {
        title: "asc",
      },
      select: branchSelect,
    });

    return NextResponse.json({
      branches: branches.map(({ id, slug, address, ...branch }) => ({
        ...branch,
        id: id.toString(),
        code: slug,
        address,
        formattedAddress: formatAddress(address),
      })),
    });
  } catch (error) {
    console.error("Failed to fetch branches:", error);

    return NextResponse.json(
      { error: "Failed to fetch branches." },
      { status: 500 }
    );
  }
}
