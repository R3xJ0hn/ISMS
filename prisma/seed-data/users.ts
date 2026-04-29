import { randomBytes } from "node:crypto";

import { hash } from "bcryptjs";

import { defineSeed } from "../_factory";
import { UserRole } from "../../lib/generated/prisma/enums";

function getDefaultSeedPassword() {
  const configuredPassword = process.env.SEED_USER_PASSWORD;

  if (configuredPassword) {
    return configuredPassword;
  }

  if (process.env.NODE_ENV !== "development") {
    throw new Error(
      "SEED_USER_PASSWORD must be set when NODE_ENV is not development."
    );
  }

  const generatedPassword = randomBytes(24).toString("base64url");

  console.info("SEED_USER_PASSWORD generated for development.");

  return generatedPassword;
}

const DEFAULT_SEED_PASSWORD = getDefaultSeedPassword();
const SUPER_ADMIN_SEED_EMAIL =
  process.env.SUPER_ADMIN_SEED_EMAIL ?? "superadmin@dcsa.example";

const BCRYPT_ROUNDS = 12;

type UserSeedRow = {
  key: string;
  email: string;
  password: string;
  role: (typeof UserRole)[keyof typeof UserRole];
  emailVerified: boolean;
  userImage: string;
};

function hashSeedPassword(password: string) {
  return hash(password, BCRYPT_ROUNDS);
}

function createSeedUserImage(label: string, backgroundColor: string) {
  const initials = label
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="${label}">
      <rect width="128" height="128" rx="24" fill="${backgroundColor}" />
      <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="44" font-weight="700">${initials}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const seedUsers = [
  {
    key: "super-admin",
    email: SUPER_ADMIN_SEED_EMAIL,
    password: DEFAULT_SEED_PASSWORD,
    role: UserRole.superAdmin,
    emailVerified: true,
    userImage: createSeedUserImage("Super Admin", "#0f766e"),
  },
  {
    key: "admin",
    email: "admin@dcsa.example",
    password: DEFAULT_SEED_PASSWORD,
    role: UserRole.admin,
    emailVerified: true,
    userImage: createSeedUserImage("Admin", "#1d4ed8"),
  },
  {
    key: "registrar",
    email: "registrar@dcsa.example",
    password: DEFAULT_SEED_PASSWORD,
    role: UserRole.registrar,
    emailVerified: true,
    userImage: createSeedUserImage("Registrar", "#7c3aed"),
  },
  {
    key: "teacher",
    email: "teacher@dcsa.example",
    password: DEFAULT_SEED_PASSWORD,
    role: UserRole.teacher,
    emailVerified: true,
    userImage: createSeedUserImage("Teacher", "#ea580c"),
  }
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
    const passwordHash = await hashSeedPassword(password);

    return prisma.user.create({
      data: {
        ...data,
        passwordHash,
      },
    });
  },
  deleteWhere: (rows) => ({
    email: {
      in: rows.map((row) => row.email),
    },
  }),
});
