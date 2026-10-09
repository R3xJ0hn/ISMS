import { CompleteAddress } from "./address";

export type SchoolBranch = {
  id: string;
  code: string;
  title: string;
  image: string | null;
  phone: string | null;
  facebookText: string | null;
  mapLink: string | null;
  address: CompleteAddress | null;
  formattedAddress: string;
};

export type SchoolBranchSummary = {
  id: string;
  title: string;
  code: string;
};
