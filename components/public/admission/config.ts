import {
  ClipboardList,
  Contact,
  GraduationCap,
  School,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type StepId =
  | "applicant"  
  | "program"  
  | "student"
  | "contact"
  | "lastSchool"
  | "guardian"
  | "currentStudent"
  | "review";

export type Step = {
  id: StepId;
  label: string;
  title: string;
  eyebrow: string;
  icon: LucideIcon;
};

export const steps: Step[] = [
{
    id: "applicant",
    label: "Applicant",
    title: "Admission Type",
    eyebrow: "Start here",
    icon: ClipboardList,
  },
  {
    id: "program",
    label: "Program",
    title: "Program Choice",
    eyebrow: "Academic path",
    icon: GraduationCap,
  },
  {
    id: "student",
    label: "Student",
    title: "Student Information",
    eyebrow: "Personal details",
    icon: UserRound,
  },
  {
    id: "contact",
    label: "Contact",
    title: "Contact and Address",
    eyebrow: "Reachable details",
    icon: Contact,
  },
  {
    id: "lastSchool",
    label: "Last School",
    title: "Previous School",
    eyebrow: "Academic record",
    icon: School,
  },
  {
    id: "guardian",
    label: "Guardian",
    title: "Parent or Guardian",
    eyebrow: "Emergency contact",
    icon: UsersRound,
  },
  {
    id: "currentStudent",
    label: "Current",
    title: "Current Student Details",
    eyebrow: "For existing students",
    icon: ClipboardList,
  },
  {
    id: "review",
    label: "Review",
    title: "Review and Consent",
    eyebrow: "Final check",
    icon: ShieldCheck,
  },
];

export const genderOptions = ["Female", "Male"];
export const civilStatusOptions = ["Single", "Married"];
export const schoolTypeOptions = ["Public", "Private", "Other"];
