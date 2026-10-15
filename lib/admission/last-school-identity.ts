type LastSchoolAddressIdentity = {
  houseNumber: string | null;
  subdivision: string | null;
  street: string | null;
  barangay: string;
  city: string;
  province: string;
  postalCode: string | null;
};

export type LastSchoolIdentity = {
  schoolName: string;
  schoolId: string | null;
  shortName: string | null;
  schoolType: string;
  address: LastSchoolAddressIdentity | null;
};

/** Compare readable school details without creating duplicates from casing or spaces. */
export function normalizeLastSchoolText(value: string | null | undefined, preserveCase = false) {
  const normalized = (value ?? "").replace(/\s+/gu, " ").trim();
  return preserveCase ? normalized : normalized.toLowerCase();
}

export function lastSchoolIdentityParts(school: LastSchoolIdentity) {
  return [
    normalizeLastSchoolText(school.schoolName),
    normalizeLastSchoolText(school.schoolId, true),
    normalizeLastSchoolText(school.shortName),
    school.schoolType,
    normalizeLastSchoolText(school.address?.houseNumber, true),
    normalizeLastSchoolText(school.address?.subdivision),
    normalizeLastSchoolText(school.address?.street),
    normalizeLastSchoolText(school.address?.barangay),
    normalizeLastSchoolText(school.address?.city),
    normalizeLastSchoolText(school.address?.province),
    normalizeLastSchoolText(school.address?.postalCode, true),
  ];
}

export function lastSchoolIdentityKey(school: LastSchoolIdentity) {
  return JSON.stringify([school.address !== null, ...lastSchoolIdentityParts(school)]);
}

export function hasCompleteLastSchoolIdentity(school: LastSchoolIdentity) {
  return Boolean(
    normalizeLastSchoolText(school.schoolName) &&
    ["Public", "Private", "Other"].includes(school.schoolType) &&
    school.address &&
    normalizeLastSchoolText(school.address.barangay) &&
    normalizeLastSchoolText(school.address.city) &&
    normalizeLastSchoolText(school.address.province)
  );
}
