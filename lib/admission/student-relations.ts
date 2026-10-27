import type { Prisma } from "@/lib/generated/prisma/client";
import type { addressDataFromProfile, guardianDataFromProfile } from "./student-fields";

type StudentAddressData = ReturnType<typeof addressDataFromProfile>;
type StudentGuardianData = ReturnType<typeof guardianDataFromProfile>;
type GuardianLink = { id: bigint; guardianId: bigint };

/** Called inside an authorized profile transaction; shared records must be copied before editing. */
export async function saveStudentAddress(
  tx: Prisma.TransactionClient,
  addressId: bigint | null,
  data: StudentAddressData,
): Promise<bigint> {
  if (addressId !== null) {
    const [studentCount, schoolCount] = await Promise.all([
      tx.student.count({ where: { addressId } }),
      tx.lastSchool.count({ where: { addressId } }),
    ]);
    if (studentCount <= 1 && schoolCount === 0) {
      await tx.address.update({ where: { id: addressId }, data, select: { id: true } });
      return addressId;
    }
  }
  return (await tx.address.create({ data, select: { id: true } })).id;
}

/** Update the chosen primary link without modifying another student's shared guardian. */
export async function saveStudentGuardian(
  tx: Prisma.TransactionClient,
  studentId: bigint,
  link: GuardianLink | undefined,
  data: StudentGuardianData,
  relationship: string,
): Promise<void> {
  const shared = link && await tx.studentGuardian.count({ where: { guardianId: link.guardianId } }) > 1;
  const guardian = link && !shared
    ? await tx.guardian.update({ where: { id: link.guardianId }, data, select: { id: true } })
    : await tx.guardian.create({
        data: { ...data, email: null, addressId: null, facebookAccount: null }, select: { id: true },
      });
  const linkData = { guardianId: guardian.id, relationship, isPrimary: true };
  if (link) await tx.studentGuardian.update({ where: { id: link.id }, data: linkData });
  else await tx.studentGuardian.create({ data: { studentId, ...linkData } });
}
