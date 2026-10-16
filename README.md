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

Check that `DATABASE_URL` points to your **empty development database**, then run:

```sh
npx prisma db push
npx prisma generate --generator client
```

This creates the basic tables and relationships from the Prisma schema. It does not add accounts, branches, programs, subjects, or sample students.

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

This repository does not include a committed migration history. `prisma/migrations` and `prisma/sql` are ignored by Git, so a fresh clone may not contain historical SQL files mentioned in older setup notes.

`prisma db push` alone is not a complete production setup. Additional PostgreSQL checks, indexes, and triggers protect the single administrator account, verification-token targets, subject rules, legacy class uniqueness, and other records. Obtain an approved schema export or reviewed SQL changes from the maintainer before putting a new database into production. The single-administrator protections must be installed after that one account exists.

Back up an existing database before applying upgrades. Do not run old transition files indiscriminately against the current schema, and keep school-reset or cleanup SQL out of routine installation: those operations remove records and can change admission statuses.

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

1. Ensure the student has a saved **Student Number** and an admission for their branch. Administrators can add/import students through **Manage Students → Admission**. For a new public applicant, assign their student number through the admission's Edit page first.
2. The student opens `/admission`, chooses **Existing student**, selects their saved branch, and verifies their student number, email, first name, last name, and birth date against the saved record.
3. The student opens the emailed secure update link, reviews and saves their information, then sets their password.
4. The student signs in at `/login` using the saved email and new password.

Completing the secure update moves a draft admission to review. Administrators review admissions in **Manage Students → Admission**; approved records appear under **Manage Students → Students**.

Students with an admission **Under review** are asked to review their information each time they sign in. They can save corrections or choose **Continue to classes**. Continuing does not approve the admission.

### Bulk Admit spreadsheet

In **Manage Students → Admission → Bulk Admit**, select the admission details that apply to every row, then upload your file. The modal includes the format instructions and an example:

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

The URL must use HTTPS and must not include extra query parameters or a fragment. The service supports the `student`, `all_students`, and `all_classworks` actions.

### Prepare and connect a class spreadsheet

Use the grading workbook layout expected by the script; an arbitrary spreadsheet with the same tab names is insufficient. Required tabs are **INPUT**, **REPORT**, **Prelim**, **Midterm**, **Pre-Finals**, and **Finals**. See the script's `CONFIG` and row-reading functions for the expected cells and columns.

- Enable **INPUT!G7** to allow records in the portal. **INPUT!G8** controls excluded activities.
- Keep student numbers in **INPUT column F** identical to the saved portal numbers, including capitalization and leading zeros. Student names must also match the report without duplicates.
- Sign in as the assigned teacher, open **My Classes → a class → Overview**, and select the add/edit icon on the spreadsheet connection card to save the Google Sheets link.
- Open **Classwork** or **Grades** to view the records. Students see only their own records for classes they belong to.

Teachers can release or hide **Prelim, Midterm, Prefinals, and Finals** independently through **Overview → Student record visibility**. Hidden periods are withheld from student classwork and grades; the final average and related summary values are also hidden while any period is hidden.

The separate student **My grades** semester page uses `STUDENT_GRADES_APPS_SCRIPT_URL`. It expects a compatible GET endpoint accepting `student_no` and `semester` (`1stSem` or `2ndSem`). The supplied class script is a POST service and does not implement that separate report endpoint.

### Add class students

In Add/Edit Class, search for saved students by name or number and select a dropdown result. The selected roster shows their names and photos, with a remove button.

**Upload Excel** can match a roster against saved students using `Student Number` and `Name` columns. It is a reference import, not student creation. Check the match preview, confirm the selection, then **save the class** to apply it.

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

The `npm test` suite mocks email and spreadsheet providers and does not connect to the database. Some older `test:*` commands in `package.json` refer to scripts that are not included in this checkout; they are not part of the first-time setup.

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
| A school is missing from the admission dropdown | Only verified schools appear. Choose **Other — school not listed**, or have an administrator add/verify it in **Manage Last Schools**. |
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
