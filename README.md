# ISMS — Student Information Management System

ISMS is a school portal for public admissions, student records, employee and teacher management, and classes connected to Google Sheets. Teachers can view their class rosters and manage which grading periods students can see. Students can review their information and view their own classwork and grades.

The project uses Next.js App Router, React, TypeScript, PostgreSQL, Prisma, and Tailwind CSS.

Already using a running installation? Start with [Set up the school](#set-up-the-school) and [Create teacher and student accounts](#create-teacher-and-student-accounts). To run the project on your computer, follow the setup steps below.

## 1. Prepare your tools

You need:

- **Node.js 22.12 or later within version 22, or Node.js 24**, with npm.
- **A PostgreSQL database**, either local or hosted on Neon. Use a separate development database while setting up.
- **An email provider**: Resend or an SMTP account. Email is needed for account activation, verification, and password recovery.
- **A code editor and terminal** opened in the project folder, where `package.json` is located.

Cloudinary is optional for profile photos. Google Apps Script is needed to display spreadsheet records inside classes.

Check that Node.js and npm are available:

```sh
node --version
npm --version
```

On Windows, if PowerShell blocks `npm` or `npx`, use `npm.cmd` and `npx.cmd` in the commands below.

## 2. Install the project

Download or clone this repository, open its folder, then install the dependencies:

```sh
npm ci
```

## 3. Create your environment file

Create a file named `.env` in the project root, beside `package.json`. There is currently no bundled `.env.example`.

Start with these settings and replace every placeholder:

```dotenv
DATABASE_URL="postgresql://DB_USER:DB_PASSWORD@DB_HOST:5432/DB_NAME?sslmode=require"
APP_URL="http://localhost:3000"
JWT_SECRET="REPLACE_WITH_YOUR_GENERATED_SESSION_SECRET"
STUDENT_UPDATE_LINK_SECRET="REPLACE_WITH_A_SEPARATE_GENERATED_SECRET"
```

For Neon, use the connection string from your database dashboard. `JWT_SECRET` must contain at least 32 bytes. Generate a random secret with this command, then run it again for `STUDENT_UPDATE_LINK_SECRET`:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Keep `.env` private. Use your actual HTTPS website address for `APP_URL` when deploying. Restart the development server after changing environment settings.

### Choose one email provider

For **Resend**, add:

```dotenv
RESEND_API_KEY="YOUR_RESEND_API_KEY"
RESEND_FROM_EMAIL="School Portal <portal@your-school.example>"
```

Use a sender address authorized by your Resend account.

For **SMTP**, add these settings instead:

```dotenv
SMTP_HOST="YOUR_SMTP_HOST"
SMTP_PORT="587"
SMTP_USER="YOUR_SMTP_USERNAME"
SMTP_PASS="YOUR_SMTP_PASSWORD"
SMTP_FROM_EMAIL="School Portal <portal@your-school.example>"
```

SMTP takes precedence whenever `SMTP_HOST` is set. Port `465` uses TLS; the default port is `587`. Keep `STUDENT_UPDATE_LINK_SECRET` configured, especially with SMTP: student admission links otherwise fall back to `RESEND_API_KEY`.

### Optional services

Add these only when you are ready to use the corresponding feature:

| Feature | Environment variables | Purpose |
| --- | --- | --- |
| Profile photos | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Upload employee, student, and account photos. All three must belong to the same Cloudinary account. |
| Cloudinary URL alternative | `CLOUDINARY_URL` | Overrides the separate Cloudinary settings when supplied. |
| Class grades and classwork | `GOOGLE_SCRIPT_URL`, `GOOGLE_SCRIPT_SECRET` | Connect the class spreadsheet service; see [Google Sheets setup](#connect-google-sheets). |
| Student semester Grades page | `STUDENT_GRADES_APPS_SCRIPT_URL` | Connect a separate compatible semester-report service. |
| Analytics | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | Enable PostHog when both are configured. |

`EMAIL_VERIFICATION_SECRET`, `TEACHER_INVITATION_SECRET`, and `PASSWORD_RESET_SECRET` can override the signing secret for their respective account flows. Each must be at least 32 bytes. Omit them to use `JWT_SECRET`; do not add empty values.

## 4. Prepare the database

Installing packages or starting the app does **not** create database tables, school data, or login accounts.

### Using an existing database

If a maintainer gave you a prepared development database, confirm that it matches [prisma/schema.prisma](prisma/schema.prisma). Generate the Prisma client:

```sh
npx prisma generate --generator client
```

If tables or columns are missing, get the reviewed database upgrade for that database before continuing.

### Starting with an empty development database

Check that `DATABASE_URL` points to your **empty development database**. In your database's SQL editor (for example, Neon's SQL Editor), first run this statement to prepare the sequence used to generate class codes:

```sql
CREATE SEQUENCE IF NOT EXISTS public.classes_class_code_seq AS BIGINT;
```

Then run these commands in the project terminal:

```sh
npx prisma db push
npx prisma generate --generator client
```

This creates the basic tables and relationships from the Prisma schema. Next, follow the class-code upgrade steps below to install its sequence ownership and reference-code protection. These steps do not add accounts, branches, programs, subjects, or sample students.

The seed runner currently has no data modules, so `npx prisma db seed` will not populate the system. If seed modules are added later, review them first: the runner calls their deletion handlers before inserting data.

### Create the first administrator

Skip this if your prepared database already has its administrator. There are no default login credentials, public administrator registration, or bundled administrator setup command.

For a new development database:

1. Run `node` in the terminal to open the Node.js console.
2. Generate a bcrypt password hash and a timestamp using the following JavaScript. Replace the example password with your own strong password before running it.

   ```js
   const { hash } = await import("bcryptjs");
   await hash("REPLACE_WITH_YOUR_OWN_STRONG_PASSWORD", 12);
   new Date().toISOString();
   ```

3. Keep the returned hash and timestamp, then enter `.exit` to leave the console.
4. Open the database editor:

   ```sh
   npx prisma studio
   ```

5. In the `users` table, create **one** account using these values:

   | Field | Value |
   | --- | --- |
   | `email` | Your real email address, in lowercase |
   | `password_hash` | The generated bcrypt hash, without the surrounding console quotes |
   | `role` | `superAdmin` |
   | `email_verified` | `false` |
   | `session_version` | `0` |
   | `updated_at` | The generated timestamp |

   Leave the ID and creation timestamp to their database defaults, and leave optional fields empty. Store the hash in `password_hash`, never the plain password.

6. Start the app in the next step, sign in, and verify your email.

The internal `superAdmin` account is displayed as **Administrator** in the portal and is hidden from ordinary account management. It is intended to be the only account with that role.

### Existing and production database changes

Reviewed incremental upgrades are stored in `prisma/updates`. There is no complete committed migration history: `prisma/migrations` and `prisma/sql` are ignored by Git, so a fresh clone may not contain historical SQL files mentioned in older setup notes.

`prisma db push` alone is not a complete production setup. Additional PostgreSQL checks, indexes, and triggers protect the single administrator account, verification-token targets, subject rules, legacy class uniqueness, and other records. Obtain an approved schema export or reviewed SQL changes from the maintainer before putting a new database into production. The single-administrator protections must be installed after that one account exists.

Back up an existing database before applying upgrades. Do not run old transition files indiscriminately against the current schema, and keep school-reset or cleanup SQL out of routine installation: those operations remove records and can change admission statuses.

#### Install class codes and statuses

For a database that already has its `classes` and `class_students` tables, run the read-only check:

```sh
node tests/migrate-class-code-status.mjs
```

Check that the class and roster counts match the database you intend to update. Copy the returned `target` fingerprint, then replace `YOUR_TARGET_FINGERPRINT` below with that value:

```sh
node tests/migrate-class-code-status.mjs --apply --expected-target=YOUR_TARGET_FINGERPRINT
npx prisma generate --generator client
```

The runner applies [the class-code and status upgrade](prisma/updates/20261018_class_code_status.sql) in a transaction. It preserves existing class data and student assignments, gives existing classes a permanent `CLS-` reference and an **Ongoing** status, and checks the result before committing. Repeating it preserves existing codes and statuses. Use this upgrade after `db push` on an empty development database as well.

#### Install admission updates and notifications

For an existing database, check the target and current schema first:

```sh
node script/migrate-admission-updates.mjs
```

Use the printed target fingerprint to apply the additive upgrade:

```sh
node script/migrate-admission-updates.mjs --apply --expected-target=YOUR_TARGET_FINGERPRINT
```

This applies [the admission update migration](prisma/updates/20261020_admission_updates_notifications.sql), adding the **Updated** status and `notifications` table. Existing admissions keep their status. Past updates are not backfilled as notifications. The runner checks the table, indexes, and relationships before committing and reads them back afterward.

## 5. Start the app

```sh
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the public website, or [http://localhost:3000/login](http://localhost:3000/login) to sign in.

The `dev` and `build` commands automatically generate the Prisma client. They do not apply database changes.

Every account must verify its email before accessing the portal. An unverified account is directed to the verification page after signing in. Open the emailed link and confirm verification, then continue to the portal.

## Set up the school

Sign in with the first administrator account and prepare these items in order:

1. **Load the initial branches and programs.** An empty database needs the school's branch, address, program, and public program-category data. Use a reviewed data import or Prisma Studio. The portal currently edits existing programs and assigns branch offerings; it does not provide initial branch or program creation forms.
2. **Manage Subjects:** add each subject's code, name, and units.
3. **Manage Programs:** edit program information, then click a program's name, code, or subject count to assign its subjects.
4. **Manage Branch Programs:** select which programs each branch offers. Public admission and class creation use these assignments.
5. **Manage Last Schools:** add verified schools for the admission dropdown. Add and Edit School share the same form and require the school's ID; students do not need to enter it when suggesting a school. Review student suggestions here before making them available to everyone.
6. **Site Settings:** fill in the About Us and Contact content used by the public website.
7. Add employees, activate teacher accounts, and prepare student records using the instructions below.
8. **Manage Classes:** choose the school year, semester, branch, program, subject, teacher, section, and year level. Add students to the roster and save.

Public program listings also need public content such as a slug, display title and code, overview, and category. A program can remain available for admission without appearing in the public catalog.

The first administrator can manage all of these areas. Ordinary `admin` accounts can manage admissions, students, user photos, last schools, branch offerings, and site settings. Employee, teacher, class, program, and subject management require the protected administrator. The `registrar` role exists in the schema but does not currently have the same management permissions as `admin`.

## Admin dashboard and navigation

Administrators land on **Dashboard** after signing in. It shows admissions awaiting review, approved admission records, student and staff account totals, pending school suggestions, and the latest five applications. The admission overview breaks down records by status. Accounts with academic management access also see class, program, and subject totals and an **Add class** shortcut.

**Student updates** shows the latest ten saved student information updates, with names, programs, branches, and update times. Click an entry to review its admission or open an already-approved student's record. These notifications are saved in the database and shared by authorized administrators; opening the dashboard does not remove them. Updated admissions count toward **Admissions to review**.

Accounts with academic management access also see **Classes needing review**. The report checks connected Google Sheet rosters against saved students and enrollment, using the same rules as each class's cross-match page. It shows issue counts and links directly to the affected class. Switch the report category to view classes that could not be checked or have no connected spreadsheet. These states are kept separate from successfully checked classes.

**Manage Classes** shows a **Needs review** mark under each affected subject. Name-only warnings stay amber; other roster issues are red. Checks load separately so search, filters, and the rest of the page remain usable. Use **Refresh review** to read the latest spreadsheets again. Sheet snapshots can otherwise be reused for up to two minutes; saved student records and class membership are checked fresh each time.

The sidebar groups pages by task:

- **Students:** Admissions, Manage Students, and Manage Last Schools.
- **Academics:** Manage Classes, Manage Programs, Manage Subjects, and Manage Branch Programs.
- **People & Access:** Manage Employees, Manage Teachers, Manage Users, and Login History.
- **Website:** Site Settings, About Us, and Contact.

Each account sees only the links its role can access. Teachers and students continue to open their own class workspace after signing in.

## Create teacher and student accounts

Saving a profile does not automatically create a usable login account. There is no public **Create account** option on the login page.

### Teachers

1. Open **Manage Employees** and add the teacher's employee record, including their real email address.
2. Set the employee role to **Teacher** and choose the correct employment status. Resigned employees cannot activate a new teacher account.
3. Open **Manage Teachers** and select **Send account setup email**.
4. The teacher opens the email and chooses a password. Saving the password verifies their email and creates both the login account and teacher link.
5. The teacher signs in at `/login` and opens **My Classes**.

A saved, eligible Teacher employee can also choose **Forgot password?** on the login page and enter their employee email to set their first password. This account-creation path is for teachers only. Admin, Registrar, and Non-teaching employee records do not receive teacher accounts through it. Non-teaching is an employee classification, not a portal login role.

### Students

New applicants begin at `/admission`. They select a branch and program, complete the form, and receive an application confirmation. This submission does not automatically create their login account.

To activate a saved student's account:

1. Ensure the student has a saved **Student Number** and an admission for their branch. Administrators can add/import students through **Students → Admissions**. For a new public applicant, assign their student number through the admission's Edit page first.
2. The student opens `/admission`, chooses **Existing student**, selects their saved branch, and verifies their student number, email, first name, last name, and birth date against the saved record.
3. The student opens the emailed secure update link, reviews and saves their information, then sets their password.
4. The student signs in at `/login` using the saved email and new password.

Completing the secure update moves a draft admission to review. Administrators review admissions in **Students → Admissions**; approved records appear under **Students → Manage Students**.

Students with an admission **Under review** are asked to review their information each time they sign in. They can save corrections or choose **Continue to classes**. Saving changes the admission to **Updated**, creates a dashboard notification, and allows the student to return to classes. The admission still needs administrator approval. Continuing without saving keeps its current review status. Existing emailed student-update links also notify administrators after a successful save; approved students remain approved.

### Bulk Admit spreadsheet

In **Students → Admissions → Bulk Admit**, select the admission details that apply to every row, then upload your file. The modal includes the format instructions and an example:

| Student Number | Email Address | First Name | Last Name | Birth Date |
| --- | --- | --- | --- | --- |
| 000123 | student@example.com | Maria | Santos | 2008-05-21 |

Use the first worksheet, place these headers in its first row, and enter one student per row. All five columns are required. An optional `Gender` column accepts `Male` or `Female`.

- Accepts `.xlsx`, `.xls`, or `.csv`, up to **5 MB** and **999 students plus one header row**.
- Format student numbers as **Text** to preserve leading zeros. Use `YYYY-MM-DD` or real Excel date cells for birth dates.
- Student numbers and emails must be unique within the file and must not already belong to saved students. Import adds records; it does not update them.
- If a row fails validation, no students are imported. Fix the reported errors and try again.

Imports create draft admissions and do not send account emails. Students use the Existing student activation steps above afterward.

### Editing profiles and photos

**Admissions → Edit Student** allows administrators to save incomplete information; blank core fields retain their saved values. The approved-student editor in **Students** and public admission forms keep their required fields.

The Admissions table starts with **Updated**, then **Review**, **Draft**, and **Rejected**, with newest submissions first in each group. Legacy Submitted records appear under Review. Search, filters, and column sorting remain available.

Choose **Save Changes** to keep the admission's current status, or **Save changes and approve** to save the edits and approve a submitted, under-review, updated, or rejected admission together. Approval moves the record into **Manage Students**. Draft admissions must be submitted first.

A green **Verified school** mark beside **Last School Attended** identifies an existing verified school or a verified replacement selected from the dropdown. Changing school details clears the mark until they match again or another verified school is selected; changing attendance dates or school year keeps it.

In **Manage Last Schools**, filter records by **Pending**, **Verified**, or **Rejected**. Click a school's admission count to see its linked students, search their admission records, and select **Edit student**. In **Last School Attended**, type in **Find a saved school** and select a result directly from the dropdown to replace a duplicate suggestion with the correct verified school. Save the student to update that admission's school link; other students and the saved school's details stay unchanged. **Add Student** uses the same optional school search. The picker also supports the arrow keys, Enter, and Escape.

On the admission form, search the saved school list first. **Other — school not listed** appears only when the search finds no matches. If the list cannot load, retry loading it before choosing a school. Suggestions reuse a matching saved school when its identity is unambiguous, even when optional details were left blank.

Employee and student forms allow optional profile photos. With Cloudinary configured, upload JPEG, PNG, or WebP files up to **5 MB**. Saving without an image preserves the existing photo; removing it requires choosing the removal option.

**Manage Users** shows account emails and names from linked employee/student profiles. Its Edit page manages the account photo. It does not create accounts or change their email, role, or password. Edit profile information through the employee or student forms.

If an administrator changes a student's login email, the student must use the new address and verify it again. **Forgot password?** is available for existing accounts of every role.

## Connect Google Sheets

A class roster in ISMS and rows in Google Sheets are managed separately. Adding a student to a portal class does not add them to the spreadsheet.

### Configure the class spreadsheet service

1. Copy [script/app-script.js](script/app-script.js) into your Google Apps Script project.
2. In the project's Script Properties, add `API_SECRET` with a random secret.
3. Deploy it as a web app. The deployment account must be able to open the connected spreadsheets, and the portal server must be able to call it without an interactive Google sign-in. Requests are authenticated by the shared secret.
4. Add these settings to `.env`, using the deployment's `/exec` URL and the same secret:

   ```dotenv
   GOOGLE_SCRIPT_URL="https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"
   GOOGLE_SCRIPT_SECRET="THE_SAME_VALUE_AS_API_SECRET"
   ```

5. Restart the app. When changing the script later, update the deployed version as well.

The URL must use HTTPS and must not include extra query parameters or a fragment. The service supports the `student`, `all_students`, `all_classworks`, and `class_roster` actions.

### Prepare and connect a class spreadsheet

Use the grading workbook layout expected by the script; an arbitrary spreadsheet with the same tab names is insufficient. Required tabs are **INPUT**, **REPORT**, **Prelim**, **Midterm**, **Pre-Finals**, and **Finals**. See the script's `CONFIG` and row-reading functions for the expected cells and columns.

- Enable **INPUT!G7** to allow records in the portal. **INPUT!G8** controls excluded activities.
- Keep student numbers in **INPUT column F** identical to the saved portal numbers, including capitalization and leading zeros. Student names must also match the report without duplicates.
- Sign in as the assigned teacher, open **My Classes → a class → Overview**, and select the add/edit icon on the spreadsheet connection card to save the Google Sheets link.
- Open **Classwork** or **Grades** to view the records. Students see only their own records for classes they belong to.

Teachers can open **My Classes → a class → Students** to compare the connected Google Sheet with saved students and class enrollment. The view includes matching issues and enrolled students missing from the sheet, with the same comparison rules as the admin Class view. Database names show saved profile photos, with pastel initials when a photo is unavailable. Use **Refresh** to check again. Comparisons are read-only and available only for the teacher's assigned classes; correct spreadsheet entries in Google Sheets and ask an administrator to update saved student records or enrollment.

Teachers can release or hide **Prelim, Midterm, Prefinals, and Finals** independently through **Overview → Student record visibility**. Hidden periods are withheld from student classwork and grades; the final average and related summary values are also hidden while any period is hidden.

The separate student **My grades** semester page uses `STUDENT_GRADES_APPS_SCRIPT_URL`. It expects a compatible GET endpoint accepting `student_no` and `semester` (`1stSem` or `2ndSem`). The supplied class script is a POST service and does not implement that separate report endpoint.

### Add class students

In **Manage Classes**, use the Branch, School year, Year level, Program, and Semester dropdowns to narrow the table. Desktop search and filters share one row; scroll the filter strip to reach more options, with **Clear filters** kept on the right whenever filters are active. The table shows the school year and semester together in one column. Student profile thumbnails show each name on hover or keyboard focus, with pastel initials when a photo is missing and a `+N` badge for the rest of the roster.

Class rows are grouped by **School year → Semester → Program → Year level**. Each group shows its matching class count, and column sorting applies within those groups. A group's heading repeats when its records continue onto another page.

Every class receives a permanent reference such as **CLS-15**. Search by this code to find the assignment; its reference stays the same when class details change. In Add/Edit Class, administrators can choose **Ongoing**, **Grade finalization** (classes have ended while grades and missing work are being finalized), or **Locked**. These are display statuses for now: they do not restrict teachers' spreadsheet or visibility changes. The **Status** filter helps locate classes in each stage.

Teacher **My Classes** and student **My classes** use the same school year, semester, program, and year-level groups. Newest school years appear first. Within each group, cards show **Ongoing**, then **Grade finalization**, then **Locked**, with subjects alphabetized within each status. Every card displays its class code and status. Search by class code, subject, or program, or combine the school year, semester, year level, program, and status filters to find a class.

In Add/Edit Class, search for saved students by name or number and select a dropdown result. The selected roster shows their names and photos, with a remove button.

**Upload Excel** can match a roster against saved students using `Student Number` and `Name` columns. It is a reference import, not student creation. Check the match preview, confirm the selection, then **save the class** to apply it.

### View a class and compare its student lists

Click a subject in **Manage Classes** to open **Class view**. The **Student list** tab shows saved enrollment, student numbers, names, profile photos, Prelim, Midterm, Prefinals, Finals, final averages, and remarks, with search, sorting, and pagination. Grades come from the connected Google Sheet and attach only to a unique matching student number. Use **Refresh grades** after spreadsheet changes.

Choose **Export → Excel (.xlsx)** to download every enrolled student, including students outside the current search or page. The workbook includes grades and a separate sheet of class details. Missing matches and unavailable grades are labeled explicitly; student numbers retain their leading zeros. Enrollment remains visible and exportable if the spreadsheet cannot be loaded.

Open **Google Sheets cross-match** to compare the connected spreadsheet with the database. This reads names from **INPUT column B** and student numbers from **column F**, starting at **row 11**. It does not depend on the REPORT tab, so you can investigate roster problems even when the grade summary fails. Enable **INPUT!G7** to allow the roster to be read.

The comparison matches exact student numbers, preserving capitalization and leading zeros. Database names display in the sheet's **Last name, First name Middle name** format, excluding the separate suffix field. Name checks compare the last name and complete first name, including every word of a multiword first name. Middle names are ignored, whether omitted, abbreviated, or different in the spreadsheet. Comparison ignores capitalization, extra whitespace, and spacing around the comma, while keeping name order, punctuation, and accents. It flags missing numbers or names, duplicate numbers or names, unmatched students, name differences, and students saved in the database but not enrolled in this class. **Name differs** stays amber; other issues are red to draw attention. Switch between **Google Sheet students** and **Missing from sheet** tabs to view the two lists. **Refresh** reads the current lists again. Comparing does not edit the database or spreadsheet; use **Edit class** or correct the sheet yourself.

Existing Apps Script installations must copy the updated [script/app-script.js](script/app-script.js) and update their deployed version to enable the new `class_roster` action. Keep the same deployment URL and shared secret.

## Useful commands

Run these from the project root:

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server. |
| `npx prisma generate --generator client` | Regenerate the database client after schema changes. |
| `npx prisma studio` | Open the editor for the currently configured database. |
| `npm run lint` | Check code style and lint rules. |
| `npm run typecheck` | Check TypeScript types. |
| `npm test` | Run the tests in `tests/*.test.ts`. |
| `npm run build` | Create a production build. |
| `npm start` | Run a completed production build. |

The `npm test` suite mocks email and spreadsheet providers and does not connect to the database.

Production builds need network access to download the configured Google fonts. For deployment, provide the environment settings to your host, use an HTTPS `APP_URL`, prepare the database and its SQL protections separately, then run the build and start commands. `npm start` uses production cookies, so serve production through HTTPS.

## Common problems

| Problem | What to check |
| --- | --- |
| Database connection fails | Confirm `DATABASE_URL`, database availability, credentials, and the connection's SSL settings. |
| A table or column is missing | The database does not match the application schema. Apply the appropriate reviewed upgrade and regenerate the Prisma client. |
| Login reports a missing or short secret | Set `JWT_SECRET` to a generated value of at least 32 bytes, then restart. |
| Verification or setup email does not arrive | Check the spam folder, provider credentials, sender authorization, and `APP_URL`. An old `SMTP_HOST` setting overrides Resend. |
| A branch has no available programs | Assign offerings through **Manage Branch Programs**. |
| A program has no subjects in Add Class | Assign subjects to it through **Manage Programs**. |
| Teacher account setup is unavailable | Check the saved employee email, Teacher role, employment status, and any conflicting existing account. |
| No classes appear | Save a class assignment for the teacher and add the student to its roster. Check the selected school-year and semester filters. |
| Class grades or classwork are unavailable | Check the script deployment, matching secret, spreadsheet access and layout, INPUT!G7, exact student number, and teacher period visibility. |
| A school is missing from the admission dropdown | Only verified schools appear. Search its name or location; if no matches remain, choose **Other — school not listed**, or have an administrator add/verify it in **Manage Last Schools**. |
| A photo upload fails | Confirm the Cloudinary cloud name and credentials belong to the same account. Check the file format and size. Photos can be left blank. |

## Where to find the code

| Location | Contents |
| --- | --- |
| `app/(public)/` | Public website, admission, account recovery, and verification pages. |
| `app/login/` | Login page and sign-in action. |
| `app/portal/` | Management pages and teacher/student workspaces. |
| `components/portal/` | Shared tables, forms, profile photos, and toast feedback. |
| `components/classroom/` | Class cards, banners, navigation, and grade displays. |
| `lib/` | Shared utilities and feature services, grouped by purpose. |
| `prisma/schema.prisma` | Current database models, relationships, and enums. |
| `script/app-script.js` | Google Sheets classwork and grade API. |
| `tests/` | Automated tests. |

For common customization, edit [lib/portal/classroom-colors.ts](lib/portal/classroom-colors.ts) for class banners and student thumbnail colors. [lib/utils.ts](lib/utils.ts) contains shared text sanitation, capitalization, optional `N/A` handling, and school-year generation. School years are generated as dropdown options rather than maintained in a separate table.

### Reusing existing code

Before adding another helper or component, check these shared pieces:

| Need | Existing code |
| --- | --- |
| Search, filters, sorting, and pagination | `components/portal/interactive-table.tsx`, with `data-table.tsx` for rendering. |
| Branch/program or program/subject selections | `components/portal/assignment-form.tsx`; `readFormRecordIds` in `lib/utils.ts` validates selections, including explicit clear-all submissions. |
| Form drafts, save notifications, and return navigation | `usePortalFormFeedback` in `components/portal/toasts.tsx`; modal forms can use `usePreservedFormDraft` without navigating. |
| Student address and guardian updates | `lib/admission/student-relations.ts`, called inside each authorized update transaction. Shared records are copied before editing. |
| Admission status labels, ordering, and update notifications | `lib/admission/status.ts` shares labels and priority. `lib/notifications.ts` writes update events inside the student save transaction and reads the protected dashboard feed. |
| Teacher account setup tokens | `lib/teachers/password-setup.ts` shares issuance, cooldown, and failed-delivery cleanup. Admin setup and password recovery retain their own eligibility checks, responses, and link lifetimes. |
| Optional profile uploads | `lib/users/profile-image.ts` shares validation, upload preparation, and cleanup across account, employee, and student forms. |
| Grade columns, sorting, and visibility | `lib/classes/presentation.ts` defines table fields; `period-visibility.ts` explicitly projects released grades for both class and semester views. |

Keep permission checks and flow-specific validation at their entry points. Shared persistence helpers assume their caller has authorized the operation. Student-facing grade responses must keep explicit field projections so hidden grades and raw spreadsheet data cannot bypass visibility settings. Use the raw form reader for passwords and signed tokens; text sanitation is for editable record fields.
