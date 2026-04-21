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
  {
    key: "malabon",
    houseNumber: "418",
    subdivision: null,
    street: "Gov. Pascual Avenue",
    barangay: "Catmon",
    city: "Malabon City",
    province: "Metro Manila",
    postalCode: "1470",
  },
] as const satisfies readonly AddressSeedRow[];

export default defineSeed({
  table: "address",
  order: 10,
  rows: seedAddresses,
  idGroup: "addresses",
  getRowKey: (row) => row.key,
  create: async ({ prisma }, { key: _key, ...data }) =>
    prisma.address.create({ data }),
  deleteWhere: (rows) => ({
    OR: rows.map(({ key: _key, ...address }) => address),
  }),
});
