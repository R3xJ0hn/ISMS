// Synthetic test fixture data only. The names, sequential phone numbers,
// example.com emails, and other personal details in this file are artificial
// and intended solely for seeding and testing, not real personal information.
import { defineSeed } from "../_factory";

type GuardianSeedRow = {
  key: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  suffix: string | null;
  contactNumber: string;
  occupation: string | null;
  email: string | null;
  addressKey: string | null;
  facebookAccount: string | null;
};

export const seedGuardians = [
  {
    key: "guardian-maria",
    firstName: "Elena",
    lastName: "Santos",
    middleName: "Marquez",
    suffix: null,
    contactNumber: "09181234501",
    occupation: "Office Administrator",
    email: "elena.santos@example.com",
    addressKey: null,
    facebookAccount: "Elena Santos",
  },
  {
    key: "guardian-john",
    firstName: "Roberto",
    lastName: "Cruz",
    middleName: "Diaz",
    suffix: null,
    contactNumber: "09181234502",
    occupation: "Sales Supervisor",
    email: "roberto.cruz@example.com",
    addressKey: null,
    facebookAccount: "Roberto Cruz",
  },
  {
    key: "guardian-angela",
    firstName: "Lorna",
    lastName: "Reyes",
    middleName: "Santos",
    suffix: null,
    contactNumber: "09181234503",
    occupation: "Small Business Owner",
    email: "lorna.reyes@example.com",
    addressKey: null,
    facebookAccount: "Lorna Reyes",
  },
  {
    key: "guardian-paolo",
    firstName: "Teresa",
    lastName: "Mendoza",
    middleName: "Ramos",
    suffix: null,
    contactNumber: "09181234504",
    occupation: "Public School Teacher",
    email: "teresa.mendoza@example.com",
    addressKey: null,
    facebookAccount: "Teresa Mendoza",
  },
  {
    key: "guardian-sofia",
    firstName: "Ramon",
    lastName: "Garcia",
    middleName: "Villanueva",
    suffix: null,
    contactNumber: "09181234505",
    occupation: "IT Support Specialist",
    email: "ramon.garcia@example.com",
    addressKey: null,
    facebookAccount: "Ramon Garcia",
  },
] as const satisfies readonly GuardianSeedRow[];

export default defineSeed({
  table: "guardian",
  order: 80,
  rows: seedGuardians,
  idGroup: "guardians",
  getRowKey: (row) => row.key,
  create: async ({ prisma, getId }, { key: _key, addressKey, ...row }) =>
    prisma.guardian.create({
      data: {
        ...row,
        addressId: addressKey
          ? getId("addresses", addressKey, "address")
          : null,
      },
    }),
  deleteWhere: (rows) => ({
    contactNumber: {
      in: rows.map((row) => row.contactNumber),
    },
  }),
});
