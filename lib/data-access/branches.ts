import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { formatCompleteAddress } from "@/lib/utils";
import { SchoolBranch } from "../types";

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

export const getCachedAdmissionBranches = unstable_cache(
  async (): Promise<SchoolBranch[]> => {
    const branches = await prisma.branch.findMany({
      orderBy: {
        title: "asc",
      },
      select: branchSelect,
    });

    return branches.map(({ id, slug, address, ...branch }) => ({
      ...branch,
      id: id.toString(),
      code: slug,
      address,
      formattedAddress: formatCompleteAddress(address),
    }));
  },
  ["admission-branches"],
  {
    revalidate: 300,
  }
);