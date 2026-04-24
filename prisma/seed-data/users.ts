import { hash } from "bcryptjs";

import { defineSeed } from "../_factory";
import { UserRole } from "../../lib/generated/prisma/enums";

const DEFAULT_SEED_PASSWORD =
  process.env.SEED_USER_PASSWORD ?? "ChangeMe123!";

const BCRYPT_ROUNDS = 12;

type UserSeedRow = {
  key: string;
  email: string;
  password: string;
  role: (typeof UserRole)[keyof typeof UserRole];
  emailVerified: boolean;
};

/**
 * Generate a bcrypt hash for a seed password.
 *
 * @param password - The plaintext password to hash
 * @returns The bcrypt hash of `password` using `BCRYPT_ROUNDS`
 */
function hashSeedPassword(password: string) {
  return hash(password, BCRYPT_ROUNDS);
}

export const seedUsers = [
  {
    key: "super-admin",
    email: "superadmin@dcsa.example",
    password: DEFAULT_SEED_PASSWORD,
    role: UserRole.superAdmin,
    emailVerified: true,
  },
  {
    key: "admin",
    email: "admin@dcsa.example",
    password: DEFAULT_SEED_PASSWORD,
    role: UserRole.admin,
    emailVerified: true,
  },
  {
    key: "registrar",
    email: "registrar@dcsa.example",
    password: DEFAULT_SEED_PASSWORD,
    role: UserRole.registrar,
    emailVerified: true,
  },
  {
    key: "teacher",
    email: "teacher@dcsa.example",
    password: DEFAULT_SEED_PASSWORD,
    role: UserRole.teacher,
    emailVerified: true,
  },
  {
    key: "student",
    email: "student@dcsa.example",
    password: DEFAULT_SEED_PASSWORD,
    role: UserRole.student,
    emailVerified: false,
  },
] as const satisfies readonly UserSeedRow[];

export default defineSeed({
  table: "user",
  order: 10,
  rows: seedUsers,
  idGroup: "users",
  getRowKey: (row) => row.key,
  create: async ({ prisma }, row) => {
    const { key, password, ...data } = row;
    void key;

    return prisma.user.create({
      data: {
        ...data,
        passwordHash: await hashSeedPassword(password),
      },
    });
  },
  deleteWhere: (rows) => ({
    email: {
      in: rows.map((row) => row.email),
    },
  }),
});
