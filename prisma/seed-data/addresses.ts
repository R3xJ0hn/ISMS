import { defineSeed } from "../_factory";

type AddressSeedRow = {
  key: string;
  houseNumber: string | null;
  subdivision: string | null;
  street: string | null;
  barangay: string;
  city: string;
  province: string;
  postalCode: string | null;
};

export const seedAddresses = [
  {
    key: "meycauayan",
    houseNumber: null,
    subdivision: null,
    street: "Datamex Bldg., Ngusong Buwaya St.",
    barangay: "Saluysoy",
    city: "Meycauayan City",
    province: "Bulacan",
    postalCode: "3020",
  },
  {
    key: "fairview",
    houseNumber: "85",
    subdivision: "East Park Subdivision",
    street: "Fairview Avenue, Commonwealth Avenue",
    barangay: "Fairview",
    city: "Quezon City",
    province: "Metro Manila",
    postalCode: "1121",
  },
  {
    key: "caloocan",
    houseNumber: "357",
    subdivision: null,
    street: "J. Teodoro St, Cor 10th Ave",
    barangay: "Caloocan",
    city: "Caloocan City",
    province: "Metro Manila",
    postalCode: "1400",
  },
  {
    key: "valenzuela",
    houseNumber: "32",
    subdivision: null,
    street: "Gotaco Bldg II, McArthur Highway",
    barangay: "Marulas",
    city: "Valenzuela City",
    province: "Metro Manila",
    postalCode: "1440",
  },
] as const satisfies readonly AddressSeedRow[];

function getAddressData(row: AddressSeedRow) {
  return {
    houseNumber: row.houseNumber,
    subdivision: row.subdivision,
    street: row.street,
    barangay: row.barangay,
    city: row.city,
    province: row.province,
    postalCode: row.postalCode,
  };
}

function isAddressSeedCleanupEnabled() {
  const cleanupFlag = process.env.SEED_CLEANUP_ENABLED?.toLowerCase();

  return (
    process.env.NODE_ENV !== "production" &&
    (cleanupFlag === "true" || cleanupFlag === "1")
  );
}

export default defineSeed({
  table: "address",
  order: 10,
  rows: seedAddresses,
  idGroup: "addresses",
  getRowKey: (row) => row.key,
  create: async ({ prisma }, row) =>
    prisma.address.create({ data: getAddressData(row) }),
  down: async ({ prisma }, rows) => {
    // Address cleanup matches persisted address fields, so keep it opt-in for
    // disposable environments only.
    if (!isAddressSeedCleanupEnabled()) {
      return;
    }

    await prisma.address.deleteMany({
      where: {
        OR: rows.map((row) => getAddressData(row)),
      },
    });
  },
});
