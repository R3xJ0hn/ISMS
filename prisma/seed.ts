import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const branches = [
  {
    code: "DCSA-MEYCAUAYAN",
    title: "DCSA Meycauayan",
    image:
      "https://res.cloudinary.com/dghjtnxjw/image/upload/v1772366051/uploads/ga78teh5pp1tqj9ia0lu.jpg",
    phone: "(0951) 296-5086",
    facebookText: "Datamex Meycauayan",
    mapLink: "https://maps.app.goo.gl/AYHnJy3oRhh6HsfC8",
    address: {
      houseNumber: null,
      subdivision: null,
      street: "Datamex Bldg., Ngusong Buwaya St.",
      barangay: "Saluysoy",
      city: "Meycauayan City",
      province: "Bulacan",
      postalCode: null,
    },
  },
  {
    code: "DCSA-FAIRVIEW",
    title: "DCSA FAIRVIEW",
    image:
      "https://res.cloudinary.com/dghjtnxjw/image/upload/v1772366137/uploads/yk1t8cek6m4jbtvigw0n.jpg",
    phone: "8921-8350",
    facebookText: "Datamex Fairview",
    mapLink: "https://maps.app.goo.gl/q5kxX4BBvuLSn9S19",
    address: {
      houseNumber: "85",
      subdivision: "East Park Subdivision",
      street: "Fairview Avenue, Commonwealth Avenue",
      barangay: "Fairview",
      city: "Quezon City",
      province: "Metro Manila",
      postalCode: "1121",
    },
  },
  {
    code: "DCSA-CALOOCAN",
    title: "DCSA CALOOCAN",
    image:
      "https://res.cloudinary.com/dghjtnxjw/image/upload/v1772366095/uploads/uxw5nxc5etqifsznmmp8.jpg",
    phone: "8366-1970",
    facebookText: "Datamex CALOOCAN",
    mapLink: "https://maps.app.goo.gl/DRcrQ8X3xjmjWKRV7",
    address: {
      houseNumber: "357",
      subdivision: null,
      street: "J. Teodoro St, Cor 10th Ave",
      barangay: "Caloocan",
      city: "Caloocan",
      province: "Metro Manila",
      postalCode: null,
    },
  },
  {
    code: "DCSA-VALENZUELA",
    title: "DCSA VALENZUELA",
    image:
      "https://res.cloudinary.com/dghjtnxjw/image/upload/v1772366252/uploads/u6bhsqs8w9lgiuhrjfyf.jpg",
    phone: "8292-7536",
    facebookText: "Datamex Valenzuela",
    mapLink: "https://maps.app.goo.gl/1zscBSdHvqhB5dPE6",
    address: {
      houseNumber: "32",
      subdivision: null,
      street: "Gotaco Bldg II, McArthur Highway",
      barangay: "Marulas",
      city: "Valenzuela",
      province: "Metro Manila",
      postalCode: null,
    },
  },
] as const;

async function seed() {
  for (const branch of branches) {
    const existingBranch = await prisma.branch.findUnique({
      where: {
        code: branch.code,
      },
      select: {
        addressId: true,
      },
    });

    if (existingBranch?.addressId) {
      await prisma.address.update({
        where: {
          id: existingBranch.addressId,
        },
        data: branch.address,
      });
    }

    await prisma.branch.upsert({
      where: {
        code: branch.code,
      },
      create: {
        code: branch.code,
        title: branch.title,
        image: branch.image,
        phone: branch.phone,
        facebookText: branch.facebookText,
        mapLink: branch.mapLink,
        address: {
          create: branch.address,
        },
      },
      update: {
        title: branch.title,
        image: branch.image,
        phone: branch.phone,
        facebookText: branch.facebookText,
        mapLink: branch.mapLink,
        ...(existingBranch?.addressId
          ? {}
          : {
              address: {
                create: branch.address,
              },
            }),
      },
    });
  }

  console.info(`Seeded ${branches.length} branches.`);
}

async function main() {
  try {
    await seed();
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    try {
      await prisma.$disconnect();
    } catch (e) {
      console.error("Failed to disconnect Prisma client:", e);
      process.exitCode = 1;
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
