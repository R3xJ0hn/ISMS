import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type BranchAddress = {
  houseNumber: string | null;
  subdivision: string | null;
  street: string | null;
  barangay: string;
  city: string;
  province: string;
  postalCode: string | null;
};

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
      select: {
        id: true,
        code: true,
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
      },
    });

    return NextResponse.json({
      branches: branches.map((branch) => ({
        id: branch.id.toString(),
        code: branch.code,
        title: branch.title,
        image: branch.image,
        phone: branch.phone,
        facebookText: branch.facebookText,
        mapLink: branch.mapLink,
        address: branch.address,
        formattedAddress: formatAddress(branch.address),
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
