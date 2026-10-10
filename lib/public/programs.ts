import { BookMarked, GraduationCap, ToolCase } from "lucide-react";

type ProgramGroup = {
  id: string;
  title: string;
  description: string;
  icon: typeof GraduationCap;
  programs: { title: string; note?: string }[];
};

export const PROGRAM_GROUPS: ProgramGroup[] = [
  {
    id: "college",
    title: "College Courses",
    description: "Degree programs for long-term careers",
    icon: GraduationCap,
    programs: [
      { title: "Bachelor of Science in Information Technology" },
      { title: "Bachelor of Science in Office Administration" },
      { title: "Bachelor of Science in Tourism Management" },
      { title: "Bachelor of Science in Hotel Management" },
      { title: "Associate in Computer Technology", note: "(2-year course ladderized to BSIT)" },
    ],
  },
  {
    id: "tvl-track",
    title: "TVL Track",
    description: "Skills-based training for work readiness",
    icon: ToolCase,
    programs: [
      { title: "Information and Communications Technology" },
      { title: "Home Economics" },
    ],
  },
  {
    id: "academic-track",
    title: "Academic Track",
    description: "Strong foundation for university pathways",
    icon: BookMarked,
    programs: [
      { title: "Science, Technology, Engineering & Mathematics" },
      { title: "Accountancy, Business & Management" },
      { title: "Humanities & Social Sciences" },
      { title: "General Academic Strand" },
    ],
  },
];
