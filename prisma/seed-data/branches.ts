import { defineSeed } from "../_factory";
import type { Prisma } from "../../lib/generated/prisma/client";

type BranchSeedRow = {
  key: string;
  slug: string;
  title: string;
  addressKey: string;
  phone: string | null;
  facebookText: string | null;
  mapLink: string | null;
  image: string | null;
};

export const seedBranches = [
  {
    key: "meycauayan",
    slug: "meycauayan",
    title: "DCSA Meycauayan",
    addressKey: "meycauayan",
    image:
      "https://res.cloudinary.com/dghjtnxjw/image/upload/v1772366051/uploads/ga78teh5pp1tqj9ia0lu.jpg",
    phone: "(0951) 296-5086",
    facebookText: "Datamex Meycauayan",
    mapLink: "https://maps.app.goo.gl/AYHnJy3oRhh6HsfC8",
  },
  {
    key: "fairview",
    slug: "fairview",
    title: "DCSA Fairview",
    addressKey: "fairview",
    image:
      "https://res.cloudinary.com/dghjtnxjw/image/upload/v1772366137/uploads/yk1t8cek6m4jbtvigw0n.jpg",
    phone: "8921-8350",
    facebookText: "Datamex Fairview",
    mapLink: "https://maps.app.goo.gl/q5kxX4BBvuLSn9S19",
  },
  {
    key: "caloocan",
    slug: "caloocan",
    title: "DCSA Caloocan",
    addressKey: "caloocan",
    image:
      "https://res.cloudinary.com/dghjtnxjw/image/upload/v1772366095/uploads/uxw5nxc5etqifsznmmp8.jpg",
    phone: "8366-1970",
    facebookText: "Datamex Caloocan",
    mapLink: "https://maps.app.goo.gl/DRcrQ8X3xjmjWKRV7",
  },
  {
    key: "valenzuela",
    slug: "valenzuela",
    title: "DCSA Valenzuela",
    addressKey: "valenzuela",
    image:
      "https://res.cloudinary.com/dghjtnxjw/image/upload/v1772366252/uploads/u6bhsqs8w9lgiuhrjfyf.jpg",
    phone: "8292-7536",
    facebookText: "Datamex Valenzuela",
    mapLink: "https://maps.app.goo.gl/1zscBSdHvqhB5dPE6",
  },
] as const satisfies readonly BranchSeedRow[];

export default defineSeed({
  table: "branch",
  order: 20,
  rows: seedBranches,
  idGroup: "branches",
  getRowKey: (row) => row.key,
  create: async ({ prisma, getId }, { key: _key, addressKey, ...row }) => {
    const data = {
      ...row,
      addressId: getId("addresses", addressKey, "address"),
    } satisfies Prisma.BranchUncheckedCreateInput;

    return prisma.branch.create({ data });
  },
  deleteWhere: (rows) => ({
    slug: {
      in: rows.map((row) => row.slug),
    },
  }),
});
