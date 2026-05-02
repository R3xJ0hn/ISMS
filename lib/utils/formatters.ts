import type { CompleteAddress } from "@/lib/types";

export function formatDisplayName(student: {
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
}) {
  return [
    student.firstName,
    student.middleName,
    student.lastName,
    student.suffix,
  ]
    .filter(Boolean)
    .join(" ");
}

export function formatCompleteAddress(address: CompleteAddress | null) {
  if (!address) {
    return "";
  }

  return [
    address.houseNumber,
    address.street,
    address.subdivision,
    address.barangay,
    address.city,
    address.province,
    address.postalCode,
  ]
    .filter(Boolean)
    .join(", ");
}
