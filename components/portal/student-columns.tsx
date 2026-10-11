import type { PortalTableColumn } from "@/components/portal/data-table";
import { formatStudentName } from "@/lib/utils";

type StudentApplicationSummary = {
  applicantType: string;
  program: { label: string };
  academicLevels: { label: string };
  student: Parameters<typeof formatStudentName>[0] & {
    email: string;
    phone: string | null;
    studentNumber: string | null;
  };
};

export const studentColumns = {
  student: {
    header: "Student",
    cell: ({ student, applicantType }) => <>
      <div className="font-medium text-foreground">{formatStudentName(student)}</div>
      <div className="mt-1 text-xs capitalize text-muted-foreground">{applicantType} applicant</div>
    </>,
  },
  studentNumber: {
    header: "Student No.",
    className: "text-muted-foreground",
    cell: ({ student }) => student.studentNumber ?? "Pending",
  },
  program: {
    header: "Program",
    cell: ({ program, academicLevels }) => <>
      <div className="font-medium text-foreground">{program.label}</div>
      <div className="mt-1 text-xs text-muted-foreground">{academicLevels.label}</div>
    </>,
  },
  contact: {
    header: "Contact",
    cell: ({ student }) => <>
      <div className="text-muted-foreground">{student.phone || "Pending"}</div>
      <div className="mt-1 text-xs text-muted-foreground">{student.email}</div>
    </>,
  },
} satisfies Record<string, PortalTableColumn<StudentApplicationSummary>>;
