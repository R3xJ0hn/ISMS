export type Address = {
  houseNumber: string | null;
  subdivision: string | null;
  street: string | null;
  barangay: string;
  city: string;
  province: string;
  postalCode: string | null;
};

export type BranchSummary = {
  id: string;
  title: string;
  code: string;
};

export type Branch = BranchSummary & {
  image: string | null;
  phone: string | null;
  facebookText: string | null;
  mapLink: string | null;
  address: Address | null;
  formattedAddress: string;
};

export type AcademicLevelOption = {
  id: string;
  label: string;
  slug: string;
};

export type ProgramOption = {
  id: string;
  code: string;
  label: string;
  programType: string;
  academicLevels: AcademicLevelOption[];
};
