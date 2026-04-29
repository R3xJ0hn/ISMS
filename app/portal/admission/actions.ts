"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as XLSX from "xlsx";

import { getCurrentSession } from "@/lib/auth";
import {
  ApplicantType,
  ApplicationStatus,
  type ApplicantType as ApplicantTypeValue,
  CivilStatus,
  Gender,
  SchoolType,
  UserRole,
} from "@/lib/generated/prisma/enums";
import { validateEmail, validatePhone, validateSchoolYear } from "@/lib/admission/validation";
import { prisma } from "@/lib/prisma";

export type AddAdmittedStudentState = {
  success: boolean;
  message: string;
};

export type EditAdmittedStudentState = AddAdmittedStudentState;
export type BulkAdmitStudentsState = AddAdmittedStudentState;
export type UpdateApplicationStatusState = {
  success: boolean;
  message: string;
  status: string;
};
type ApplicationStatusValue =
  (typeof ApplicationStatus)[keyof typeof ApplicationStatus];

const initialState = {
  success: false,
  message: "",
} satisfies AddAdmittedStudentState;

function parseBirthDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);
  const day = Number.parseInt(dayText, 10);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function optionalText(value: string) {
  return value ? value : null;
}

function readFormText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseId(value: string) {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  return BigInt(value);
}

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function readRowText(row: unknown[], columnIndex: number | undefined) {
  if (columnIndex === undefined) {
    return "";
  }

  const value = row[columnIndex];

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value ?? "").trim();
}

function parseExcelDate(value: unknown) {
  if (value instanceof Date) {
    return parseBirthDate(value.toISOString().slice(0, 10));
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);

    if (!parsed) {
      return null;
    }

    return parseBirthDate(
      `${parsed.y.toString().padStart(4, "0")}-${parsed.m
        .toString()
        .padStart(2, "0")}-${parsed.d.toString().padStart(2, "0")}`
    );
  }

  const text = String(value ?? "").trim();

  if (!text) {
    return null;
  }

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);

  if (isoMatch) {
    return parseBirthDate(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`);
  }

  const slashMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(text);

  if (!slashMatch) {
    return parseBirthDate(text);
  }

  const month = Number.parseInt(slashMatch[1], 10);
  const day = Number.parseInt(slashMatch[2], 10);
  const yearText = slashMatch[3];
  const parsedYear = Number.parseInt(yearText, 10);
  const year = parsedYear < 100 ? 2000 + parsedYear : parsedYear;

  return parseBirthDate(
    `${year.toString().padStart(4, "0")}-${month
      .toString()
      .padStart(2, "0")}-${day.toString().padStart(2, "0")}`
  );
}

function parseGender(value: string) {
  const normalized = value.trim().toLowerCase();

  if (normalized === "male" || normalized === "m") {
    return Gender.Male;
  }

  if (normalized === "female" || normalized === "f") {
    return Gender.Female;
  }

  return null;
}

function findColumn(headers: string[], aliases: string[]) {
  return headers.findIndex((header) => aliases.includes(header));
}

async function requireAdmin() {
  const session = await getCurrentSession();

  if (
    !session ||
    (session.role !== UserRole.admin && session.role !== UserRole.superAdmin)
  ) {
    redirect("/portal");
  }
}

export async function addAdmittedStudentAction(
  previousState: AddAdmittedStudentState = initialState,
  formData: FormData
): Promise<AddAdmittedStudentState> {
  void previousState;

  await requireAdmin();

  const studentNumber = readFormText(formData, "studentNumber");
  const email = readFormText(formData, "email").toLowerCase();
  const firstName = readFormText(formData, "firstName");
  const lastName = readFormText(formData, "lastName");
  const birthDate = parseBirthDate(readFormText(formData, "birthDate"));
  const gender = readFormText(formData, "gender");
  const birthplace = readFormText(formData, "birthplace");
  const phone = readFormText(formData, "phone");
  const applicantType = readFormText(formData, "applicantType");
  const branchId = parseId(readFormText(formData, "branchId"));
  const programId = parseId(readFormText(formData, "programId"));
  const academicLevelsId = parseId(readFormText(formData, "academicLevelsId"));

  if (
    !studentNumber ||
    !email ||
    !firstName ||
    !lastName ||
    !birthDate ||
    !gender ||
    !birthplace ||
    !phone ||
    !applicantType ||
    !branchId ||
    !programId ||
    !academicLevelsId
  ) {
    return {
      success: false,
      message: "Complete all fields before adding the student.",
    };
  }

  if (
    !Object.values(ApplicantType).includes(applicantType as ApplicantTypeValue) ||
    !Object.values(Gender).includes(gender as (typeof Gender)[keyof typeof Gender]) ||
    !validateEmail(email) ||
    !validatePhone(phone)
  ) {
    return {
      success: false,
      message: "Complete all fields with valid information.",
    };
  }

  const [branch, program, academicLevel] = await Promise.all([
    prisma.branch.findUnique({
      where: {
        id: branchId,
      },
      select: {
        id: true,
      },
    }),
    prisma.program.findUnique({
      where: {
        id: programId,
      },
      select: {
        id: true,
        programType: true,
      },
    }),
    prisma.academicLevels.findUnique({
      where: {
        id: academicLevelsId,
      },
      select: {
        id: true,
      },
    }),
  ]);

  if (!branch || !program || !academicLevel) {
    return {
      success: false,
      message:
        "Set up at least one branch, program, and academic level before adding admitted students.",
    };
  }

  const existingStudent = await prisma.student.findFirst({
    where: {
      OR: [
        {
          studentNumber,
        },
        {
          email,
        },
      ],
    },
    select: {
      id: true,
      email: true,
      studentNumber: true,
    },
  });

  if (existingStudent) {
    return {
      success: false,
      message:
        existingStudent.studentNumber === studentNumber
          ? "A student with that student number already exists."
          : "A student with that email already exists.",
    };
  }

  await prisma.$transaction(async (transaction) => {
    const student = await transaction.student.create({
      data: {
        studentNumber,
        email,
        firstName,
        lastName,
        birthDate,
        gender: gender as (typeof Gender)[keyof typeof Gender],
        civilStatus: null,
        citizenship: null,
        birthplace,
        phone,
      },
      select: {
        id: true,
      },
    });

    await transaction.admissionApplication.create({
      data: {
        studentId: student.id,
        applicantType: applicantType as ApplicantTypeValue,
        applicationStatus: ApplicationStatus.draft,
        branchId: branch.id,
        programType: program.programType,
        programId: program.id,
        academicLevelsId: academicLevel.id,
        remarks: "Manually admitted by admin.",
        submittedAt: null,
      },
    });
  });

  revalidatePath("/portal/admission");

  return {
    success: true,
    message: "Student added to admitted list.",
  };
}

export async function bulkAdmitStudentsAction(
  previousState: BulkAdmitStudentsState = initialState,
  formData: FormData
): Promise<BulkAdmitStudentsState> {
  void previousState;

  await requireAdmin();

  const applicantType = readFormText(formData, "applicantType");
  const branchId = parseId(readFormText(formData, "branchId"));
  const programId = parseId(readFormText(formData, "programId"));
  const academicLevelsId = parseId(readFormText(formData, "academicLevelsId"));
  const file = formData.get("studentsFile");

  if (
    !applicantType ||
    !branchId ||
    !programId ||
    !academicLevelsId ||
    !(file instanceof File) ||
    file.size === 0
  ) {
    return {
      success: false,
      message: "Select applicant/program details and upload an Excel file.",
    };
  }

  if (!Object.values(ApplicantType).includes(applicantType as ApplicantTypeValue)) {
    return {
      success: false,
      message: "Select a valid applicant type.",
    };
  }

  const [branch, program, academicLevel] = await Promise.all([
    prisma.branch.findUnique({
      where: {
        id: branchId,
      },
      select: {
        id: true,
      },
    }),
    prisma.program.findUnique({
      where: {
        id: programId,
      },
      select: {
        id: true,
        programType: true,
      },
    }),
    prisma.academicLevels.findUnique({
      where: {
        id: academicLevelsId,
      },
      select: {
        id: true,
      },
    }),
  ]);

  if (!branch || !program || !academicLevel) {
    return {
      success: false,
      message: "Select a valid branch, program, and academic level.",
    };
  }

  let rows: unknown[][];

  try {
    const workbook = XLSX.read(await file.arrayBuffer(), {
      cellDates: false,
      type: "array",
    });
    const firstSheet = workbook.SheetNames[0];

    if (!firstSheet) {
      return {
        success: false,
        message: "The uploaded workbook does not contain any sheets.",
      };
    }

    rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], {
      header: 1,
      raw: true,
      defval: "",
    }) as unknown[][];
  } catch {
    return {
      success: false,
      message: "We could not read the uploaded Excel file.",
    };
  }

  const headerRowIndex = rows.findIndex((row) =>
    row.some((cell) => normalizeHeader(cell) === "studentnumber")
  );

  if (headerRowIndex < 0) {
    return {
      success: false,
      message:
        "The file must include headers for Student Number, Email Address, First Name, Last Name, and Birth date.",
    };
  }

  const headers = rows[headerRowIndex].map(normalizeHeader);
  const columns = {
    studentNumber: findColumn(headers, ["studentnumber", "studentno", "studentid"]),
    email: findColumn(headers, ["emailaddress", "studentemail", "email"]),
    firstName: findColumn(headers, ["firstname", "givenname"]),
    lastName: findColumn(headers, ["lastname", "surname", "familyname"]),
    birthDate: findColumn(headers, ["birthdate", "birthdate", "dateofbirth", "birthday"]),
    gender: findColumn(headers, ["gender", "sex"]),
  };

  if (
    columns.studentNumber < 0 ||
    columns.email < 0 ||
    columns.firstName < 0 ||
    columns.lastName < 0 ||
    columns.birthDate < 0
  ) {
    return {
      success: false,
      message:
        "The file must include Student Number, Email Address, First Name, Last Name, and Birth date columns.",
    };
  }

  const errors: string[] = [];
  const parsedStudents = rows
    .slice(headerRowIndex + 1)
    .map((row, index) => {
      const rowNumber = headerRowIndex + index + 2;
      const studentNumber = readRowText(row, columns.studentNumber);
      const email = readRowText(row, columns.email).toLowerCase();
      const firstName = readRowText(row, columns.firstName);
      const lastName = readRowText(row, columns.lastName);
      const birthDate = parseExcelDate(row[columns.birthDate]);
      const genderText = readRowText(row, columns.gender);
      const gender = genderText ? parseGender(genderText) : null;

      if (!studentNumber && !email && !firstName && !lastName && !birthDate) {
        return null;
      }

      if (!studentNumber || !email || !firstName || !lastName || !birthDate) {
        errors.push(`Row ${rowNumber}: complete all required student columns.`);
      } else if (!validateEmail(email)) {
        errors.push(`Row ${rowNumber}: enter a valid email address.`);
      } else if (genderText && !gender) {
        errors.push(`Row ${rowNumber}: enter Male or Female for gender.`);
      }

      return {
        rowNumber,
        studentNumber,
        email,
        firstName,
        lastName,
        birthDate,
        gender,
      };
    })
    .filter((row) => row !== null);

  if (parsedStudents.length === 0) {
    return {
      success: false,
      message: "The uploaded file does not contain any student rows.",
    };
  }

  const studentNumbers = new Set<string>();
  const emails = new Set<string>();

  for (const student of parsedStudents) {
    if (studentNumbers.has(student.studentNumber)) {
      errors.push(`Row ${student.rowNumber}: duplicate student number in file.`);
    }

    if (emails.has(student.email)) {
      errors.push(`Row ${student.rowNumber}: duplicate email in file.`);
    }

    studentNumbers.add(student.studentNumber);
    emails.add(student.email);
  }

  if (errors.length === 0) {
    const existingStudents = await prisma.student.findMany({
      where: {
        OR: [
          {
            studentNumber: {
              in: [...studentNumbers],
            },
          },
          {
            email: {
              in: [...emails],
            },
          },
        ],
      },
      select: {
        studentNumber: true,
        email: true,
      },
    });

    for (const existingStudent of existingStudents) {
      if (existingStudent.studentNumber) {
        errors.push(
          `Student number ${existingStudent.studentNumber} already exists.`
        );
      } else {
        errors.push(`Email ${existingStudent.email} already exists.`);
      }
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      message: errors.slice(0, 5).join(" "),
    };
  }

  try {
    await prisma.$transaction(async (transaction) => {
      const students = await transaction.student.createManyAndReturn({
        data: parsedStudents.map((studentRow) => {
          if (!studentRow.birthDate) {
            throw new Error(`Row ${studentRow.rowNumber} is missing a birth date.`);
          }

          return {
            studentNumber: studentRow.studentNumber,
            email: studentRow.email,
            firstName: studentRow.firstName,
            lastName: studentRow.lastName,
            birthDate: studentRow.birthDate,
            gender: studentRow.gender,
            civilStatus: null,
            citizenship: null,
            birthplace: null,
            phone: null,
          };
        }),
        select: {
          id: true,
          studentNumber: true,
        },
      });
      const studentsByNumber = new Map(
        students.map((student) => [student.studentNumber, student.id])
      );

      await transaction.admissionApplication.createMany({
        data: parsedStudents.map((studentRow) => {
          const studentId = studentsByNumber.get(studentRow.studentNumber);

          if (!studentId) {
            throw new Error(
              `Could not create application for row ${studentRow.rowNumber}.`
            );
          }

          return {
            studentId,
            applicantType: applicantType as ApplicantTypeValue,
            applicationStatus: ApplicationStatus.draft,
            branchId: branch.id,
            programType: program.programType,
            programId: program.id,
            academicLevelsId: academicLevel.id,
            remarks: `Bulk admitted from ${file.name}.`,
            submittedAt: null,
          };
        }),
      });
    }, {
      timeout: 20_000,
    });
  } catch (error) {
    console.error("Failed to bulk admit students:", error);

    return {
      success: false,
      message:
        "We could not import the students. Check the file for duplicate or invalid rows and try again.",
    };
  }

  revalidatePath("/portal/admission");

  return {
    success: true,
    message: `Imported ${parsedStudents.length} admitted student${
      parsedStudents.length === 1 ? "" : "s"
    }.`,
  };
}

export async function updateApplicationStatusAction(
  previousState: UpdateApplicationStatusState,
  formData: FormData
): Promise<UpdateApplicationStatusState> {
  await requireAdmin();

  const applicationId = parseId(readFormText(formData, "applicationId"));
  const status = readFormText(formData, "applicationStatus");

  if (
    !applicationId ||
    !Object.values(ApplicationStatus).includes(status as ApplicationStatusValue)
  ) {
    return {
      success: false,
      message: "Select a valid application status.",
      status: previousState.status,
    };
  }

  const application = await prisma.admissionApplication.findUnique({
    where: {
      id: applicationId,
    },
    select: {
      applicationStatus: true,
      submittedAt: true,
    },
  });

  if (!application || application.applicationStatus === ApplicationStatus.draft) {
    return {
      success: false,
      message: "Draft applications cannot be changed from this table.",
      status: application?.applicationStatus ?? previousState.status,
    };
  }

  await prisma.admissionApplication.update({
    where: {
      id: applicationId,
    },
    data: {
      applicationStatus: status as ApplicationStatusValue,
      submittedAt:
        status === ApplicationStatus.draft
          ? null
          : application.submittedAt ?? new Date(),
    },
  });

  revalidatePath("/portal/admission");

  return {
    success: true,
    message: "Application status updated.",
    status: status as ApplicationStatusValue,
  };
}

export async function editAdmittedStudentAction(
  previousState: EditAdmittedStudentState = initialState,
  formData: FormData
): Promise<EditAdmittedStudentState> {
  void previousState;

  await requireAdmin();

  const studentId = parseId(readFormText(formData, "studentId"));
  const applicationId = parseId(readFormText(formData, "applicationId"));
  const applicantType = readFormText(formData, "applicantType");
  const branchId = parseId(readFormText(formData, "branchId"));
  const programId = parseId(readFormText(formData, "programId"));
  const academicLevelsId = parseId(readFormText(formData, "academicLevelsId"));
  const studentNumber = readFormText(formData, "studentNumber");
  const firstName = readFormText(formData, "firstName");
  const lastName = readFormText(formData, "lastName");
  const middleName = readFormText(formData, "middleName");
  const suffix = readFormText(formData, "suffix");
  const birthDate = parseBirthDate(readFormText(formData, "birthDate"));
  const gender = readFormText(formData, "gender");
  const civilStatus = readFormText(formData, "civilStatus");
  const citizenship = readFormText(formData, "citizenship");
  const birthplace = readFormText(formData, "birthplace");
  const religion = readFormText(formData, "religion");
  const email = readFormText(formData, "email").toLowerCase();
  const phone = readFormText(formData, "phone");
  const facebookAccount = readFormText(formData, "facebookAccount");
  const addressHouseNumber = readFormText(formData, "addressHouseNumber");
  const addressSubdivision = readFormText(formData, "addressSubdivision");
  const addressStreet = readFormText(formData, "addressStreet");
  const addressBarangay = readFormText(formData, "addressBarangay");
  const addressCity = readFormText(formData, "addressCity");
  const addressProvince = readFormText(formData, "addressProvince");
  const addressPostalCode = readFormText(formData, "addressPostalCode");
  const guardianFirstName = readFormText(formData, "guardianFirstName");
  const guardianLastName = readFormText(formData, "guardianLastName");
  const guardianMiddleName = readFormText(formData, "guardianMiddleName");
  const guardianSuffix = readFormText(formData, "guardianSuffix");
  const guardianRelationship = readFormText(formData, "guardianRelationship");
  const guardianContactNumber = readFormText(formData, "guardianContactNumber");
  const guardianOccupation = readFormText(formData, "guardianOccupation");
  const lastSchoolName = readFormText(formData, "lastSchoolName");
  const lastSchoolIdText = readFormText(formData, "lastSchoolId");
  const lastSchoolShortName = readFormText(formData, "lastSchoolShortName");
  const lastSchoolType = readFormText(formData, "lastSchoolType");
  const lastSchoolHouseNumber = readFormText(formData, "lastSchoolHouseNumber");
  const lastSchoolSubdivision = readFormText(formData, "lastSchoolSubdivision");
  const lastSchoolStreet = readFormText(formData, "lastSchoolStreet");
  const lastSchoolBarangay = readFormText(formData, "lastSchoolBarangay");
  const lastSchoolCity = readFormText(formData, "lastSchoolCity");
  const lastSchoolProvince = readFormText(formData, "lastSchoolProvince");
  const lastSchoolPostalCode = readFormText(formData, "lastSchoolPostalCode");
  const lastSchoolYear = readFormText(formData, "lastSchoolYear");
  const lastSchoolYearLevel = readFormText(formData, "lastSchoolYearLevel");
  const lastSchoolGraduationDate = readFormText(formData, "lastSchoolGraduationDate");
  const parsedLastSchoolGraduationDate = lastSchoolGraduationDate
    ? parseBirthDate(lastSchoolGraduationDate)
    : null;

  if (
    !studentId ||
    !applicationId ||
    !branchId ||
    !programId ||
    !academicLevelsId ||
    !applicantType ||
    !studentNumber ||
    !email ||
    !firstName ||
    !lastName ||
    !birthDate ||
    !gender ||
    !birthplace ||
    !phone ||
    !addressBarangay ||
    !addressCity ||
    !addressProvince ||
    !guardianFirstName ||
    !guardianLastName ||
    !guardianRelationship ||
    !guardianContactNumber ||
    !lastSchoolName ||
    !lastSchoolType ||
    !lastSchoolBarangay ||
    !lastSchoolCity ||
    !lastSchoolProvince ||
    !lastSchoolYear ||
    !lastSchoolYearLevel
  ) {
    return {
      success: false,
      message: "Complete all required fields before saving the student.",
    };
  }

  if (
    !Object.values(Gender).includes(
      gender as (typeof Gender)[keyof typeof Gender]
    ) ||
    !Object.values(ApplicantType).includes(
      applicantType as ApplicantTypeValue
    ) ||
    (civilStatus &&
      !Object.values(CivilStatus).includes(
        civilStatus as (typeof CivilStatus)[keyof typeof CivilStatus]
      )) ||
    !Object.values(SchoolType).includes(
      lastSchoolType as (typeof SchoolType)[keyof typeof SchoolType]
    ) ||
    !validateEmail(email) ||
    !validatePhone(phone) ||
    !validatePhone(guardianContactNumber) ||
    !validateSchoolYear(lastSchoolYear) ||
    (lastSchoolGraduationDate && !parsedLastSchoolGraduationDate)
  ) {
    return {
      success: false,
      message: "Complete all required fields with valid information.",
    };
  }

  const existingStudent = await prisma.student.findFirst({
    where: {
      id: {
        not: studentId,
      },
      OR: [
        {
          studentNumber,
        },
        {
          email,
        },
      ],
    },
    select: {
      email: true,
      studentNumber: true,
    },
  });

  if (existingStudent) {
    return {
      success: false,
      message:
        existingStudent.studentNumber === studentNumber
          ? "A student with that student number already exists."
          : "A student with that email already exists.",
    };
  }

  const [branch, program, academicLevel] = await Promise.all([
    prisma.branch.findUnique({
      where: {
        id: branchId,
      },
      select: {
        id: true,
      },
    }),
    prisma.program.findUnique({
      where: {
        id: programId,
      },
      select: {
        id: true,
        programType: true,
      },
    }),
    prisma.academicLevels.findUnique({
      where: {
        id: academicLevelsId,
      },
      select: {
        id: true,
      },
    }),
  ]);

  if (!branch || !program || !academicLevel) {
    return {
      success: false,
      message: "Select a valid branch, program, and academic level.",
    };
  }

  await prisma.$transaction(async (transaction) => {
    const student = await transaction.student.findUnique({
      where: {
        id: studentId,
      },
      select: {
        addressId: true,
        guardians: {
          orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
          take: 1,
          select: {
            id: true,
            guardianId: true,
          },
        },
      },
    });

    const application = await transaction.admissionApplication.findFirst({
      where: {
        id: applicationId,
        studentId,
      },
      select: {
        lastSchoolId: true,
        lastSchool: {
          select: {
            addressId: true,
          },
        },
      },
    });

    if (!student || !application) {
      throw new Error("Student admission record not found.");
    }

    const addressData = {
      houseNumber: optionalText(addressHouseNumber),
      subdivision: optionalText(addressSubdivision),
      street: optionalText(addressStreet),
      barangay: addressBarangay,
      city: addressCity,
      province: addressProvince,
      postalCode: optionalText(addressPostalCode),
    };
    let addressId: bigint;

    if (student.addressId) {
      const addressStudentCount = await transaction.student.count({
        where: {
          addressId: student.addressId,
        },
      });

      if (addressStudentCount > 1) {
        const address = await transaction.address.create({
          data: addressData,
        });
        addressId = address.id;
      } else {
        const address = await transaction.address.update({
          where: {
            id: student.addressId,
          },
          data: addressData,
        });
        addressId = address.id;
      }
    } else {
      const address = await transaction.address.create({
        data: addressData,
      });
      addressId = address.id;
    }

    const primaryGuardianLink = student.guardians[0];

    if (primaryGuardianLink) {
      const guardianData = {
        firstName: guardianFirstName,
        lastName: guardianLastName,
        middleName: optionalText(guardianMiddleName),
        suffix: optionalText(guardianSuffix),
        contactNumber: guardianContactNumber,
        occupation: optionalText(guardianOccupation),
      };
      const guardianLinkCount = await transaction.studentGuardian.count({
        where: {
          guardianId: primaryGuardianLink.guardianId,
        },
      });

      const guardian =
        guardianLinkCount > 1
          ? await transaction.guardian.create({
              data: guardianData,
            })
          : await transaction.guardian.update({
              where: {
                id: primaryGuardianLink.guardianId,
              },
              data: guardianData,
            });

      await transaction.studentGuardian.update({
        where: {
          id: primaryGuardianLink.id,
        },
        data: {
          guardianId: guardian.id,
          relationship: guardianRelationship,
          isPrimary: true,
        },
      });
    } else {
      const guardian = await transaction.guardian.create({
        data: {
          firstName: guardianFirstName,
          lastName: guardianLastName,
          middleName: optionalText(guardianMiddleName),
          suffix: optionalText(guardianSuffix),
          contactNumber: guardianContactNumber,
          occupation: optionalText(guardianOccupation),
        },
      });
      await transaction.studentGuardian.create({
        data: {
          studentId,
          guardianId: guardian.id,
          relationship: guardianRelationship,
          isPrimary: true,
        },
      });
    }

    const lastSchoolAddressData = {
      houseNumber: optionalText(lastSchoolHouseNumber),
      subdivision: optionalText(lastSchoolSubdivision),
      street: optionalText(lastSchoolStreet),
      barangay: lastSchoolBarangay,
      city: lastSchoolCity,
      province: lastSchoolProvince,
      postalCode: optionalText(lastSchoolPostalCode),
    };
    const lastSchoolAddress = application.lastSchool?.addressId
      ? await transaction.address.update({
          where: {
            id: application.lastSchool.addressId,
          },
          data: lastSchoolAddressData,
        })
      : await transaction.address.create({
          data: lastSchoolAddressData,
        });
    const lastSchoolData = {
      schoolName: lastSchoolName,
      schoolId: optionalText(lastSchoolIdText),
      shortName: optionalText(lastSchoolShortName),
      schoolType: lastSchoolType as (typeof SchoolType)[keyof typeof SchoolType],
      addressId: lastSchoolAddress.id,
    };
    const lastSchool = application.lastSchoolId
      ? await transaction.lastSchool.update({
          where: {
            id: application.lastSchoolId,
          },
          data: lastSchoolData,
        })
      : await transaction.lastSchool.create({
          data: lastSchoolData,
        });

    await transaction.admissionApplication.update({
      where: {
        id: applicationId,
      },
      data: {
        applicantType: applicantType as ApplicantTypeValue,
        branchId: branch.id,
        programType: program.programType,
        programId: program.id,
        academicLevelsId: academicLevel.id,
        lastSchoolId: lastSchool.id,
        LSSchoolYearEnd: lastSchoolYear,
        LSAttainedLevelText: lastSchoolYearLevel,
        LSGraduationDate: parsedLastSchoolGraduationDate,
      },
    });

    await transaction.student.update({
      where: {
        id: studentId,
      },
      data: {
        studentNumber,
        firstName,
        lastName,
        middleName: optionalText(middleName),
        suffix: optionalText(suffix),
        birthDate,
        gender: gender as (typeof Gender)[keyof typeof Gender],
        civilStatus: civilStatus
          ? (civilStatus as (typeof CivilStatus)[keyof typeof CivilStatus])
          : null,
        citizenship: optionalText(citizenship),
        birthplace,
        religion: optionalText(religion),
        email,
        phone,
        facebookAccount: optionalText(facebookAccount),
        addressId,
      },
    });
  });

  revalidatePath("/portal/admission");
  revalidatePath(`/portal/admission/${applicationId.toString()}/edit`);

  return {
    success: true,
    message: "Student details updated.",
  };
}
