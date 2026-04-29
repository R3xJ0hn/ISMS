import { defineSeed } from "../_factory";
import { CivilStatus, Gender } from "../../lib/generated/prisma/enums";

type StudentSeedRow = {
  key: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  suffix: string | null;
  birthDate: string;
  gender?: (typeof Gender)[keyof typeof Gender] | null;
  civilStatus?: (typeof CivilStatus)[keyof typeof CivilStatus] | null;
  citizenship?: string | null;
  birthplace?: string | null;
  religion: string | null;
  email: string;
  phone?: string | null;
  facebookAccount: string | null;
  addressKey: string | null;
};

export const seedStudents = [
  {
    key: "2612345",
    studentNumber: "2612345",
    firstName: "Maria",
    lastName: "Santos",
    middleName: "Lopez",
    suffix: null,
    birthDate: "2006-02-14",
    gender: Gender.Female,
    civilStatus: CivilStatus.Single,
    citizenship: "Filipino",
    birthplace: "Meycauayan City, Bulacan",
    religion: "Roman Catholic",
    email: "maria.santos2612345@example.com",
    phone: "09171234501",
    facebookAccount: "Maria Santos",
    addressKey: null,
  },
  {
    key: "2612346",
    studentNumber: "2612346",
    firstName: "John",
    lastName: "Cruz",
    middleName: "Michael",
    suffix: null,
    birthDate: "2005-11-03",
    gender: Gender.Male,
    civilStatus: CivilStatus.Single,
    citizenship: "Filipino",
    birthplace: "Quezon City",
    religion: "Christian",
    email: "john.cruz2612346@example.com",
    phone: "09171234502",
    facebookAccount: "John Cruz",
    addressKey: null,
  },
  {
    key: "2612347",
    studentNumber: "2612347",
    firstName: "Angela",
    lastName: "Reyes",
    middleName: "Mae",
    suffix: null,
    birthDate: "2004-07-28",
    gender: Gender.Female,
    civilStatus: CivilStatus.Single,
    citizenship: "Filipino",
    birthplace: "Caloocan City",
    religion: "Roman Catholic",
    email: "angela.reyes2612347@example.com",
    phone: "09171234503",
    facebookAccount: "Angela Reyes",
    addressKey: null,
  },
  {
    key: "2612348",
    studentNumber: "2612348",
    firstName: "Paolo",
    lastName: "Mendoza",
    middleName: "Luis",
    suffix: null,
    birthDate: "2009-06-21",
    gender: Gender.Male,
    civilStatus: CivilStatus.Single,
    citizenship: "Filipino",
    birthplace: "Valenzuela City",
    religion: "Christian",
    email: "paolo.mendoza2612348@example.com",
    phone: "09171234504",
    facebookAccount: "Paolo Mendoza",
    addressKey: null,
  },
  {
    key: "2612349",
    studentNumber: "2612349",
    firstName: "Sofia",
    lastName: "Garcia",
    middleName: "Anne",
    suffix: null,
    birthDate: "2007-09-09",
    gender: Gender.Female,
    civilStatus: CivilStatus.Single,
    citizenship: "Filipino",
    birthplace: "Malabon City",
    religion: "Roman Catholic",
    email: "sofia.garcia2612349@example.com",
    phone: "09171234505",
    facebookAccount: "Sofia Garcia",
    addressKey: null,
  },
] as const satisfies readonly StudentSeedRow[];

export default defineSeed({
  table: "student",
  order: 70,
  rows: seedStudents,
  idGroup: "students",
  getRowKey: (row) => row.key,
  create: async ({ prisma, getId, dateOnly }, { key: _key, birthDate, addressKey, ...row }) =>
    prisma.student.create({
      data: {
        ...row,
        birthDate: dateOnly(birthDate),
        addressId: addressKey
          ? getId("addresses", addressKey, "address")
          : null,
      },
    }),
  deleteWhere: (rows) => ({
    studentNumber: {
      in: rows.map((row) => row.studentNumber),
    },
  }),
});
