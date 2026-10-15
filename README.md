# ISMS

Student Information Management System built with Next.js App Router, React, TypeScript, PostgreSQL, and Prisma. It includes public admissions, secure student record updates, portal access, admissions management, grades, and login history.

## Development

```sh
npm ci
npm run dev
```

Configure `.env` first. `dev` and `build` generate the Prisma client automatically. The database must already match `prisma/schema.prisma`; apply schema changes separately against your intended database.

Portal action results use dismissible success/error toasts through `components/portal/toasts.tsx`. The display is mounted once in the portal layout, so notifications survive navigation, refreshes, and modal closure. Form validation remains beside its fields; repeated action results notify once per submission.

Successful saves from portal edit forms return to their parent lists: student admission edits to Admissions, employees to Manage Employees, classes to Manage Classes, programs to Manage Programs, teacher setup pages to Manage Teachers, and teacher spreadsheet edits to My Classes. Failed saves remain on the form. Student edit fields display normalized text initially and when focus leaves a field; names, addresses, guardian details and school text use the same sanitation and capitalization rules as server saves. Emails stay lowercase, and identifiers, dates, enums and URL casing keep their formats. Controlled text and selection fields retain corrections when saving fails.

`nullableInputText` in `lib/utils.ts` returns `null` for blank optional text or an exact `N/A` marker in any capitalization after sanitation. Student, guardian and employee suffixes use it when saving; real suffixes such as `Jr.`, `Sr.` and `III` remain valid. Student edit forms show absent suffixes as empty inputs.

| Configuration | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection |
| `JWT_SECRET` | Session signing secret, at least 32 bytes |
| `APP_URL` | Public base URL for account emails and password reset; HTTPS in production |
| `STUDENT_UPDATE_LINK_SECRET` | Update link signing secret; falls back to `RESEND_API_KEY` |
| `EMAIL_VERIFICATION_SECRET` | Email-verification signing secret, at least 32 bytes; falls back to `JWT_SECRET` |
| `TEACHER_INVITATION_SECRET` | Teacher account setup signing secret, at least 32 bytes; falls back to `JWT_SECRET` |
| `PASSWORD_RESET_SECRET` | Password reset signing secret, at least 32 bytes; falls back to `JWT_SECRET` |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Email delivery through Resend |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL` | Optional SMTP delivery; takes precedence when `SMTP_HOST` is set |
| `STUDENT_GRADES_APPS_SCRIPT_URL` | External grades endpoint |
| `GOOGLE_SCRIPT_URL`, `GOOGLE_SCRIPT_SECRET` | Apps Script deployment and server-only secret for classwork and class grade summaries |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | Optional analytics |

`NEXT_PUBLIC_APP_URL` and `VERCEL_URL` are fallback base URLs when `APP_URL` is absent. Secrets stay in server modules and local environment configuration.

## Public program catalog

The homepage, Programs page, and course detail pages read their catalog from PostgreSQL. `program_groups` stores category descriptions, education levels, pathway headings, and display order. `programs` stores both admission data and public course details, including slugs, notes, overviews, topics, pathways, and category membership. Its `public_title` and `public_code` fields preserve public display names while keeping existing admission labels and codes intact.

Public entries require `slug`, `publicTitle`, `publicCode`, `overview`, and `groupId`. Programs without these fields remain valid for admission and are excluded from public listings. Update course content directly in these database records; display icons are selected in `lib/public/programs.ts`. Branch availability comes from `branch_program`, independently of public catalog membership.

Super admins can open **Management → Manage Programs** at `/portal/programs` and edit existing programs, including admission names and codes, program type, public content, category, and display order. Each topic or pathway occupies one line. Choosing **Not listed publicly** removes the public category while retaining the course content and admission record. The list, edit page, and save action require a super admin session. Saves refresh the catalog and both the old and new course URLs. No database migration is needed.

The Programs table has a bounded scroll area with a sticky header. Its search matches names, codes, types, categories, and public-page status across the complete loaded catalog. Click a column heading to toggle ascending or descending order. Pagination defaults to 10 rows, with 25 and 50 available; searching, sorting, and changing the page size return to the first page.

This checkout contains the Prisma schema and an optional seed runner, with no configured seed modules or catalog SQL scripts. Set up a new database separately and populate its catalog records before serving public pages. Generating the Prisma client does not create tables or seed data.

## Employee records

Employee profiles live in `employees`, independently of login accounts. The table includes a unique text employee ID, separate first/last/middle names and suffix, date/place of birth, gender, civil status, nationality, address, contact number, unique email address, TIN, SSS, PhilHealth, Pag-IBIG, date started, role, and employment status. First and last names are required in add/edit forms; middle name and suffix are optional. Lists and teacher setup emails compose the display name from these fields. Dates use PostgreSQL `DATE`; employee/contact/government identifiers use text so zeros, prefixes, and hyphens are preserved. The four government ID fields are optional. Internal record IDs and created/updated timestamps follow the other database models.

Super admins can open **Management → Manage Employees** at `/portal/employees` to add and edit all employee fields. The overview supports search, column sorting, pagination, and role/status filters. Personal, contact, employment, and government details are grouped in the form; the four government identifiers are optional text fields. Only super admins can access the pages, read records, or save changes.

Employee roles use the separate `EmployeeRole` enum: Admin (`admin`), Registrar (`registrar`), Teacher (`teacher`), and Non-teaching (`nonTeaching`). Student and Super Admin are unavailable in forms and filters and rejected on the server. Employment status uses `EmployeeStatus` with `Regular`, `Probationary`, `Contractual`, and `Resigned`, without an assumed default. Gender and civil status reuse the existing enums. Saves sanitize text and capitalize human-readable words, normalize email to lowercase, and preserve business/government identifier formatting. The server validates required fields, real dates, date order, enum choices, and case-insensitive employee ID/email conflicts. The protected administrator's email cannot be assigned to an employee, and matching existing profiles are excluded from employee reads and edit requests. The list reads only overview fields; sensitive profile fields are loaded for editing, and employee routes are excluded from analytics. Employee rows do not create login accounts or change portal permissions; Non-teaching employees cannot use teacher account setup.

To add the table to an existing database, run this SQL once and regenerate the client:

```sh
npx prisma db execute --file prisma/sql/20261013_add_employees.sql
npx prisma db execute --file prisma/sql/20261013_employee_status_resigned.sql
npx prisma db execute --file prisma/sql/20261013_employee_roles.sql
npx prisma generate --generator client
```

For an existing employees table still using `UserRole`, apply only the employee-role transition above. It preserves supported roles and every other field. Legacy Student or Super Admin employee rows stop the transaction rather than being reclassified automatically.

For an existing database with `employees.full_name` and classes without branches, apply these transitions in order and regenerate the client:

```sh
npx prisma db execute --file prisma/sql/20261013_employee_names_class_branch.sql
npx prisma db execute --file prisma/sql/20261013_remove_employee_legacy_name.sql
npx prisma generate --generator client
```

If the combined transition was already applied, run only `20261013_remove_employee_legacy_name.sql`. This final transition drops the temporary original-name column and discards its saved values. Employee names use only first name, last name, middle name and suffix. The existing test employee profiles whose structured fields are empty display **Name not set** and remain editable; add/edit forms require first and last names. Employee IDs, other profile fields, linked accounts and teacher records are retained. A database check rejects partial or blank structured names while allowing existing profiles with all four name fields empty.

Existing classes keep their rosters and spreadsheet links; their branch stays unassigned until selected on edit. New and edited classes require a saved branch. Class assignment uniqueness includes the branch, allowing the same teacher, subject, section, year level and school year at different branches. A supplemental index preserves uniqueness for unassigned legacy classes.

Run `npm run test:employee-names-class-branch` to verify name/data preservation, structured-name constraints, branch foreign keys and assignment uniqueness, and rollback in isolated transaction fixtures.

Run `npm run test:remove-employee-legacy-name` to verify the final name-column removal, preservation of employee relationships and already structured names, name validation and rollback.

## Site Settings

Administrators can open **Site Settings** in the portal sidebar to manage **About Us** and **Contact** at `/portal/site-settings`. The public navigation opens `/about` and `/contact`. The About Us editor controls the title, overview, mission, and vision. The Contact editor controls email, phone, address, introduction, office hours, map, Facebook, and official website links. Shared public header and footer contacts use the saved values. Leave optional sections or links blank to hide them.

Settings use one `site_settings` record with ID `1`. Reading an empty table displays the existing school overview and contact details. Each editor updates its own fields, preserving the other section. Failed saves retain the form values; successful saves show a toast and return to Site Settings. The server sanitizes plain text, validates contact details and safe HTTP(S) links, and restricts reads and writes in the portal to administrator roles.

For another database that does not yet have the settings table, apply the additive migration and regenerate the client:

```sh
npx prisma db execute --file prisma/sql/20261015_site_settings.sql
npx prisma generate --generator client
```

The migration adds only `site_settings` and enforces a single settings row and text-length limits. Run `npm run test:site-settings` to verify it in an isolated schema whose fixtures are rolled back.

## Protected administrator account

The internal `superAdmin` role retains its management permissions. Its account identity is hidden from employee management and login-history results, including sign-ins recorded before an account held that role. Teacher lists, invitation requests, and class lists also exclude legacy profiles linked to that account. Its own sidebar uses the generic Administrator name and label without showing its email or personal avatar. Teacher pages refer to the administrator without exposing this internal role.

After provisioning exactly one administrator account, apply this SQL once:

```sh
npx prisma db execute --file prisma/sql/20261013_single_superadmin.sql
```

The migration checks that exactly one account already has `superAdmin`, preserves its credentials, and adds a partial unique index that rejects additional accounts or promotions, including concurrent writes. Database triggers prevent deleting or demoting the protected account and truncating the users table. Email verification, password resets, and ordinary account updates remain available. These PostgreSQL protections are maintained by the SQL transition rather than Prisma-generated table definitions, so apply it to every new database after provisioning the single account. The application has no account-creation flow for this role.

Run `npm run test:account-roles` to verify role conversion, rollback, uniqueness, account protection, and recovery-compatible updates in transaction-only fixture schemas. Application records stay untouched and fixture objects are rolled back.

## Teacher accounts

The `teachers` table links an employee profile to a login account through two required columns: `employee_id` references `employees.id` (the internal record ID), and `user_id` references `users.id`. Each employee and account can appear only once. Foreign keys prevent missing references and deletion of a linked employee or account.

To create the link table in an existing database, run this SQL once and regenerate the client:

```bash
npx prisma db execute --file prisma/sql/20261013_add_teachers.sql
npx prisma generate --generator client
```

Super admins can open **Management → Manage Teachers** at `/portal/teachers` to search, sort, and browse employees whose role is `teacher`, including their employee ID, name, email, employment status, and account status. Create or edit the employee profile through **Manage Employees**. Each eligible employee has a **Send account setup email** button that sends to their saved email address. **Resend setup email** is available after a 60-second cooldown. Employees whose email already belongs to a login account are shown as an account conflict and cannot receive another account setup email.

Account creation starts from saved school records. Teachers receive account setup emails from an administrator through **Manage Teachers**, or enter their saved employee email through **Forgot password** to choose their first password. Both paths require an eligible Teacher employee record and email verification before creating an account. Other employee roles cannot use this setup path.

The email's account setup button opens `/teacher/activate?token=...`, shows the employee's name and email, and asks them to choose and confirm their own password. Submitting the form verifies the email and atomically creates a `users` record with role `teacher`, a bcrypt password hash, and `email_verified = true`, along with its `teachers` link. The teacher can then sign in through `/login`. Opening the email's button alone does not create an account. Existing accounts are never overwritten or promoted by account setup.

Pending setup tokens share `verification_tokens` with purpose `teacherSetup`. They reference the saved employee through `employee_id`, with `user_id` empty because no account exists until activation. Other purposes reference a user with no employee target. A database constraint enforces exactly the appropriate target for each purpose. Each signed setup token binds the internal employee ID, current email, expiry, and unique setup ID. Setup emails expire after one hour and work once; resending invalidates only earlier teacher-setup tokens for that employee. Changing the employee's email, role, or employment status to `Resigned` invalidates an outstanding token. The server checks eligibility again when saving, and failed activation rolls back both account creation and token consumption. Teacher management and activation routes are excluded from analytics.

For an existing database that still contains `teacher_invitations`, apply these two transitions in order and regenerate the client. The first must commit before the second uses the new enum value:

```sh
npx prisma db execute --file prisma/sql/20261013_teacher_setup_token_purpose.sql
npx prisma db execute --file prisma/sql/20261013_teacher_setup_verification_tokens.sql
npx prisma generate --generator client
```

The transition copies pending, expired, and consumed setup tokens into the shared ledger before dropping the old table. Setup identifiers, employee targets, expiry, consumption status, and creation times remain unchanged; local invitation IDs are replaced by IDs from the shared token sequence. Existing signed emails remain compatible because they identify tokens by `jti`. Existing user-purpose tokens and credentials remain unchanged, and no early teacher user accounts are created. Colliding token identifiers, missing employee targets, or unexpected table dependencies roll back the table transition. On an older database without the initial invitation table, its historical creation script precedes this transition; the current application never reads that table.

Run `npm run test:teacher-setup-tokens` to check preservation, purpose/target constraints, cascades, shared IDs, and rollback in transaction-only fixture schemas. No application records or emails are involved.

Configure `APP_URL` as the portal's public HTTPS origin for the email's account setup button, for example `https://portal.example.com`. Local development falls back to `http://localhost:3000`. Account setup emails use the existing SMTP or Resend configuration and `TEACHER_INVITATION_SECRET` (at least 32 bytes), falling back to `JWT_SECRET`.

## Forgot password

**Forgot password?** on `/login` opens `/forgot-password` for every account role. Enter an account email to reset a password, or an eligible saved Teacher employee's email to create their first password. Valid addresses receive the same response whether an account exists, delivery fails, or requests are throttled. Requests are limited to five per email and twenty per IP every fifteen minutes, with a sixty-second cooldown between emails. Email delivery runs after the response so provider latency does not identify registered accounts.

The email opens `/reset-password?token=...` with a password and confirmation form. Links expire after thirty minutes, work once, and bind the existing user ID, current email, current credentials, and session version. The server uses the shared password rules and bcrypt byte limit. Completing the reset updates the existing account's password, verifies the email proved by the link, invalidates other password reset links, and signs out all existing sessions. The user then signs in normally. A separate password-change notification contains no credentials.

If no account exists, the server checks for exactly one saved employee with the entered email, the Teacher role, a status other than Resigned, and no linked teacher account. The emailed thirty-minute link opens **Create your password** at the same reset route. Saving a valid password proves the current employee email and atomically creates the verified teacher user and teacher link. No account is created when requesting or opening the email. Eligibility is checked again on submission; changed employee details, conflicting accounts, expired or reused tokens prevent activation. Setup shares the existing `teacherSetup` token purpose and cooldown with administrator emails; administrator setup links keep their one-hour expiry.

Existing-account password reset tokens reuse `verification_tokens` with purpose `passwordReset`. They keep the account role and do not consume student-update/email-verification tokens. `users.session_version` starts at zero to retain existing sessions; reset increments it, and portal guards compare it against each session cookie. Older cookies without a version are treated as zero. Student password setup and account email changes also require the link's version to match, so an older student link cannot replace a newer password or redirect recovery email; ordinary student profile reads and edits remain available. Requests and reset forms are excluded from analytics and use no-index/no-referrer metadata. The teacher setup path uses the existing schema and needs no additional migration.

Apply the password reset migration once and regenerate the client:

```sh
npx prisma db execute --file prisma/sql/20261013_add_password_reset.sql
npx prisma generate --generator client
```

Configure the public HTTPS `APP_URL` and the existing SMTP or Resend provider for delivery. Development falls back to `http://localhost:3000`. Reset protections follow the [OWASP Forgot Password guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

## Email verification

Every account role must verify its email before accessing portal pages or actions. Successful sign-in sends unverified users to `/verify-email`, where they can request a link for their current account email. Requests have a 60-second cooldown and use the configured SMTP or Resend provider. Opening the link displays a confirmation form; selecting **Verify email** confirms the address. Links expire after one hour and work once. The portal reads the current account's role, email, and verification status from the database, so an existing session recognizes verification and blocks access after an email change. Teacher activation verifies the invited email when the teacher sets their password.

The shared `verification_tokens` table stores `id`, `jti`, `purpose`, `user_id`, `employee_id`, `expires_at`, `consumed_at`, and `created_at`. Email verification, password reset, and student-update tokens require a user target; teacher setup requires an employee target before the user exists. The database rejects missing, mixed, or wrong-purpose targets. It has no `student_id` or `email` column. `studentUpdate` tokens retain the existing student profile and password-setup workflow. Email snapshots stay in signed links and are checked against the current account address. Every operation scopes token reads and writes to its purpose and target. Verification links cannot be used as session cookies, and a link for an older email cannot verify a changed address. Verification pages are excluded from site analytics.

For an existing database with `student_update_tokens`, apply this transition once, then regenerate the client:

```sh
npx prisma db execute --file prisma/sql/20261012_universal_verification_tokens.sql
npx prisma db execute --file prisma/sql/20261012_verification_tokens_user_only.sql
npx prisma generate --generator client
```

If the table has already been renamed, run only `20261012_verification_tokens_user_only.sql`. The transitions preserve existing token IDs, expiry, and consumption status. Student tokens are linked to user accounts by the student email before the student and email columns are removed. Missing accounts are created as unverified students with password setup pending; their placeholder password value cannot authenticate. Existing accounts keep their credentials and verification status. Ambiguous account mappings stop the migration and roll back.

Existing student links remain usable for student updates and password setup. Their unknown original email snapshots do not newly verify an account; users with those links verify through `/verify-email` after signing in. New student links create or reuse the target user before issuance, bind their signed email snapshot to the actual recipient, and verify the account only when that snapshot matches its current address. Student profile email changes update the same user and clear verification; password setup always targets the linked user ID. Applying the migration does not send emails.

## Classes and teacher summaries

Super admins can open **Management → Manage Classes** at `/portal/classes` to add or edit a teacher's class assignment using its school year, branch, program, section name, year level, saved teacher profile, and subject. The form selects **Branch → Program → Subject** from saved offerings and program subject assignments; subject names are derived on the server. Year levels follow the program type. Teacher choices show the employee name and account email. `classes.teacher_id` references the primary key `teachers.employee_id`, rather than a user ID. Duplicate assignments for the same teacher, branch, program, school year, section, year level, and subject are rejected. Add Class puts assignment details and the student roster side by side on desktop and stacks them on mobile.

Each class has a student roster through `class_students` (`class_id` → `classes.id`, `student_id` → `students.id`). A student can belong to several subject classes, and a class can contain several students. Choose saved students in the class form; no student login account is required. Roster changes save atomically with the class assignment. The management list shows the roster count, and the assigned teacher can view the saved roster on the class detail page. The teacher supplies the Google Sheets link for grade summaries; the administrator's edits preserve it.

For an existing database whose class assignments still reference users, apply the relationship migration once:

```sh
npx prisma db execute --file prisma/sql/20261013_class_teacher_students.sql
npx prisma generate --generator client
```

The migration preserves each assignment's teacher account, class details, spreadsheet link, and timestamps while remapping the teacher ID. Legacy teacher accounts without a teacher profile are linked only to a unique saved Teacher employee with a matching email. Missing or ambiguous profiles stop the transaction without changing records. Existing class rosters start empty; assign saved students through Manage Classes.

Run `npm run test:class-relations` to check the SQL migration's teacher ID remapping, rollback, roster uniqueness, and foreign keys in isolated fixture schemas using the configured database. The test removes its schemas afterward and leaves application records untouched.

Teachers land on **My Classes** at `/portal/my-classes` after signing in. Their Classroom-style workspace has a collapsible desktop sidebar, mobile navigation drawer, account menu, and responsive class cards with subject search and school-year filtering. Each class opens an **Overview**, **Classwork**, **Students**, and **Grades** workspace, with tabs above the content that stay below the portal header while scrolling. The subject banner appears only in Overview. Overview's grade connection card shows a red disconnected status with an add icon, or a green connected status with an edit icon. The icon opens a modal for saving the Google Sheets link; failed saves retain the draft and errors, and successful saves return to My Classes. Classwork displays the spreadsheet's activities, maximum scores, category weights, and grading periods. Students shows the saved roster; Grades shows the students' numbers, names, prelim, midterm, prefinals, finals, average, remarks, and notes. Teachers can search and sort the summary, refresh it, or open the source spreadsheet. Refresh keeps the selected Classwork or Grades tab. Portal access resolves the signed-in user to their teacher profile; another teacher's class URL returns a not-found page before any roster or spreadsheet read.

Students land on **My classes** at `/portal/classroom`. Cards use the existing `class_students` assignments for their saved student record. A class opens **Overview**, **Classwork**, and **Grades** tabs with its teacher, branch, section, year level, school year, activities, and the student's own scores and summary. The server resolves one student profile from the current verified account email and checks membership before requesting only that student's spreadsheet records. The saved student number must match the returned identifier exactly, preserving casing and leading zeros; ambiguous profiles and mismatched records are refused. Classmates' records and source spreadsheet URLs are never sent to the student interface. The existing semester Grades page remains available at `/portal/grades` through **My grades** navigation. Empty assignments and unavailable summaries show helpful states. The Classroom palette applies only to teacher and student portals; management pages keep their existing layout. This workspace uses saved class, roster, and spreadsheet data.

Teachers can use **My Classes → a class → Overview → Student record visibility** to release or hide Prelim, Midterm, Prefinals, and Finals independently. Each switch saves automatically. The assigned teacher continues to see every period; students receive only released grades and Classwork periods. If any period is hidden, the server also withholds the final average, equivalent, remarks, and notes so they cannot reveal hidden grades. Existing and new classes start with all periods visible. The spreadsheet's `INPUT!G7` sharing setting still applies.

The separate student semester **Grades** page applies these settings to matching assigned subjects. It matches subject codes first, or exact normalized names when a code is missing, and combines restrictions across matching classes. The semester spreadsheet response does not identify a class or school year, so a hidden period in any matching assigned class remains hidden there. Unmatched subjects keep their existing display.

For an older database, add the four class visibility columns and regenerate the client:

```sh
npx prisma db execute --file prisma/sql/20261015_class_period_visibility.sql
npx prisma generate --generator client
```

The configured Neon database has received this additive migration, preserving existing records and timestamps. `npm run test:class-period-visibility` verifies defaults, independent toggles, constraints, preservation, and rollback using an isolated transaction-only schema. No Apps Script deployment update is required for these controls.

For an older database without a `classes` table, create its initial table before applying the academic-level enum migration. Apply the employee and teacher migrations described above, then the class relationship migration before using the current application:

```sh
npx prisma db execute --file prisma/sql/20261012_add_classes.sql
```

The initial creation script represents the older schema. The relationship migration above supplies the current teacher foreign key and student roster table; regenerate the client after all required transitions. Class management and teacher roster routes are excluded from analytics.

If `classes` already exists with a required spreadsheet URL, apply the nullable-column update instead:

```sh
npx prisma db execute --file prisma/sql/20261012_teacher_spreadsheet_links.sql
npx prisma generate --generator client
```

Set `GOOGLE_SCRIPT_URL` to the HTTPS Apps Script `/macros/s/.../exec` deployment URL and `GOOGLE_SCRIPT_SECRET` to its configured `API_SECRET`. Deploy the current `script/app-script.js` version with `all_students`, `all_classworks`, and `student` actions. Teacher summaries use `all_students`; teacher classwork uses `all_classworks`. Student class pages use one `student` request with their saved student number for both their grades and activity scores. Credentials and spreadsheet IDs remain on the server. The script reads student names/numbers from `INPUT`, summaries from `REPORT`, and activities from the Prelim, Midterm, Pre-Finals, and Finals sheets. `INPUT!G7` must enable portal records; a false setting hides the spreadsheet records in both portals. `INPUT!G8` controls whether activities marked as excludable are shown, and the portal filters them again before rendering. Classwork is read-only; edits are made in the connected spreadsheet and appear on refresh. Students without a number cannot load their own scores. Names and nonempty student numbers must be unique so records can be matched safely. Empty classwork, missing configuration, provider errors, hidden records, and invalid responses have explicit portal states.

If teachers can load classwork but a student cannot load their records, verify that the student's saved **Student number** matches `INPUT` column F exactly, including leading zeros and letter case. Assigning a student to a portal class does not add a row to its external spreadsheet. Their name must also have a unique matching row in `REPORT`. Existing period sheets without that student's row return ungraded activity scores rather than blocking their other records; duplicate matching rows still stop the request. The script returns fixed error codes for missing student numbers, missing report records, and ambiguous matches, without returning personal details. The portal displays instructions for those errors. Update the Apps Script deployment after changing `script/app-script.js`; editing the local file alone does not update Google's deployed service.

Student class **Grades** pages emphasize the recorded final average and its grade equivalent, with the four grading periods shown as smaller supporting scores. `lib/grade-equivalence.ts` applies the supplied school scale after rounding the final average to the nearest whole percent; for example, 97.5% becomes 98% and maps to 1.00 (Excellent). The displayed average retains its recorded value. Exact INC/Incomplete markers show an incomplete result, and missing or invalid averages have no calculated equivalent. Saved remarks and notes are visible when all grading periods are released. The collapsible **Grading scale** table preserves all supplied ranges and blank descriptions. This is a display conversion and does not calculate an average from period scores or change stored grades.

## My information

Teacher and student classroom navigation and account menus offer **My information** at `/portal/information`. This read-only page shows the signed-in teacher's employee profile or the student's saved profile, latest admission information, guardian, and previous school details. Corrections use the existing administrator-managed forms. Teacher reads resolve the current user ID through `teachers.user_id`; student reads resolve a unique saved profile from the current verified account email, treating email punctuation literally. Missing or ambiguous profiles show a helpful account-only state. The service accepts no profile ID or email from the URL and excludes credential fields, government identifiers, and other people's records. Information routes are excluded from analytics. No database migration is needed.

## Public branches

The public **Branches** navigation opens `/branches`. The directory displays saved campus photos, full addresses, map links, phone numbers, and Facebook details using the same cached branch catalog as admission. Missing photos and contact fields have fallbacks; empty or unavailable catalogs show helpful states. Valid map and social URLs open in a new tab, and valid phone numbers can be called directly. The landing page's **View all branches** and footer's **School Branches** also open the directory. This public page requires no login or database migration.

## Subjects and program assignments

**Management → Manage Subjects** at `/portal/subjects` lets the protected administrator add and edit subject code, name, and units. Its table supports search, sorting, and pagination. Names use the shared sanitation and capitalization rules; codes preserve their case. Units accept 0 through 99.99 with up to two decimal places. Case-insensitive name/code uniqueness is checked in the service and database. Renaming a subject updates its linked class display names in the same transaction. Successful form saves return to Manage Subjects with a toast.

Click a program's name, code, or subject count in **Manage Programs** to open `/portal/programs/[programId]/subjects`. Select subjects from the catalog and save their assignments. Search preserves hidden selections. Subjects used by existing classes must remain assigned until those classes are updated. The service validates saved IDs and modifies only that program's changed assignments in a serializable transaction; restrictive foreign keys prevent removing an assignment referenced by a class. The existing program editor remains available through **Edit**.

The `subjects` table holds the catalog; `program_subjects` has a composite primary key of `program_id` and `subject_id`. Classes store these IDs and reference the selected assignment. The server checks that the branch offers the program and the program includes the subject before saving a class and roster together. Forged subject text is ignored. Changing a branch or program clears dependent dropdown selections.

Apply this transition once to an older database, then regenerate the client:

```sh
npx prisma db execute --file prisma/sql/20261014_subjects_program_subjects.sql
npx prisma generate --generator client
```

The migration creates subjects from existing class names, links those classes, and preserves all original class details, rosters, and spreadsheet links. Existing subjects have blank codes and units until completed in Manage Subjects. Legacy class program assignments remain empty until explicitly selected on edit. New and edited classes require both a program and its assigned subject. The configured Neon database has already received this transition. `npm run test:subjects-programs` checks preservation, duplicate protection, foreign keys, units, and rollback using transaction-only fixture schemas.

## Branch program offerings

Admins and the protected administrator can open **Management → Manage Branch Programs** at `/portal/branch-programs`. The list supports search, sorting, and pagination. **Assign programs** opens a branch's saved choices from the program catalog. Selections survive search filters and failed saves; administrators can select all programs or clear every selection. Successful saves return to the branch list with a toast. Assignments replace only that branch's offerings in a serializable transaction after validating the branch and every selected program.

The `branch_program` table stores `branch_id`, `program_id`, and `created_at`. Its composite primary key prevents duplicate offerings, and restrictive foreign keys require saved branches and programs. Public admission reads these assignments rather than sections. Available year levels come from the shared `AcademicLevel` enum and program-type compatibility rules. Submission verifies that the selected program is still offered by the selected branch and rejects forged program families or incompatible levels. A branch with no assignments shows the existing no-programs message until programs are assigned.

The `sections` and `enrollments` tables and `EnrollmentStatus` enum are removed. Existing student verification and secure profile updates use saved admission applications. Latest admission information shows application status, branch, program, and year level; obsolete enrollment school-year and section fields are removed. Classes retain their own `section_name` field and student rosters.

Apply this transition to a database with the previous tables, then regenerate the client:

```sh
npx prisma db execute --file prisma/sql/20261014_branch_program.sql
npx prisma generate --generator client
```

The transaction copies distinct existing section and admission branch/program pairs into the new table before dropping the two old tables. It refuses to remove nonempty enrollment history or unexpected dependencies. The configured database's old tables were empty; its existing admission records supplied the initial offering. Run `npm run test:branch-program-migration` to verify backfill, constraints, preservation, and rollback in isolated transaction-only fixture schemas.

## School-year options

Editable school-year fields use dropdowns in public admission, secure student updates, admission management, and class management. Their options come from `generateSchoolYears` in `lib/utils.ts`, which builds consecutive `YYYY-YYYY+1` labels from 1900 through the next calendar year in Asia/Manila, newest first. The range updates when forms render and includes an existing saved value so historical records remain selectable. Optional `startYear`, `endYear`, `referenceDate`, and `selectedValue` parameters support other ranges and deterministic callers; year bounds follow the existing 1900–2100 validation limits. Admission retains last-school years, and classes store their own school year without a separate school-year table.

## Architecture

Academic levels use the `AcademicLevel` enum: `Grade11`, `Grade12`, `FirstYear`, `SecondYear`, `ThirdYear`, and `FourthYear`. Admission applications store it in `academic_level`; class assignments use the same enum in `year_level`. The `academic_levels` table and its foreign-key ID columns are no longer needed. `lib/academic-levels.ts` provides display labels, dropdown choices, and program compatibility: Bachelor uses First through Fourth Year, Associate uses First and Second Year, and Senior High uses Grade 11 and Grade 12. Public and portal forms submit enum values, and the server validates them before saving.

For an existing database with the academic-level table, apply this transition once, then regenerate the client:

```sh
npx prisma db execute --file prisma/sql/20261013_academic_level_enum.sql
npx prisma generate --generator client
```

The transaction maps existing level slugs to enum values in each dependent record before removing the foreign keys, old ID columns, and table. Existing class labels such as `2nd year` map to `SecondYear`. Unmapped values, conflicting class assignments, or unexpected table dependencies stop the migration and roll back. Last-school attained-level text remains available for historical school levels outside the six current enrollment choices.

```text
app/
  (public)/       Public catalog, admission, account recovery and verification
  login/          Sign-in page and server action
  portal/         Role-protected management and classroom routes
components/
  auth/           Shared password and unavailable-link interfaces
  classroom/      Teacher/student workspace, class cards and grade displays
  portal/         Tables, assignment forms, page layouts and save feedback
  public/         Public navigation, footer and homepage sections
  ui/             Shared UI primitives
hooks/            Browser subscriptions
lib/
  admission/      Student field rules, profile data, school matching and admission workflows
  auth/           Shared account emails/tokens, verification and password recovery
  classes/        Assignments, rosters, teacher visibility and spreadsheet records
  portal/         Current-student identity, own information and portal choices
  employees/      Employee records and shared create/edit logic
  teachers/       Employee eligibility and teacher account activation
  programs/       Program editing
  subjects/       Subject catalog and shared create/edit logic
  branch-programs/  Branch offerings
  program-subjects/  Program subject assignments
  site-settings/  Public About/Contact settings
  public/         Public school details and catalog queries
  types/          Shared domain contracts
  auth.ts         Sessions, credentials and role guards
  utils.ts        Pure text, form, ID, date and display helpers
  validation.ts   Date, contact, school-year and password rules
  email.ts        SMTP/Resend transport
  prisma.ts       Database client lifecycle
  student-grades.ts  Semester grades provider
  table.ts        Search, sorting and pagination
prisma/           Database schema, SQL transitions and optional seed runner
script/           Apps Script provider and isolated database checks
tests/            Behavior, authorization, privacy and UI regressions
```

Pages compose queries and UI. Route `actions.ts` files define explicit async server boundaries and delegate admission business logic to `lib/admission`. Client components call those boundaries; imports of server record types use `import type`. Feature services do not import route or UI modules.

Public form fields live in `form-schema.ts` and render through `form-fields.tsx` and `form-sections.tsx`. The same schema supplies empty values, step requirements, and student update fields. `wizard-state.ts` owns state transitions and dependency resets; `admission-wizard.tsx` connects them to server actions. `admission-confirmation.tsx` handles the slip and QR code. Portal add/edit forms share their definitions in `admitted-student-form.tsx`, with modal and control behavior in `admission-ui.tsx`.

`lib/admission/student-fields.ts` is the common source for student field names, normalization, validation, and student/address/guardian/school write builders. Public submission, portal edits, secure updates, and school matching use those same rules. `records.ts` shares the profile and school query selections and serializes saved records for edit/review forms. When adding a stored field, update its schema, field map, UI definition, and serialization together.

Use `getCurrentStudent` in `lib/portal/student.ts` for student-owned reads. It checks the verified session, treats email punctuation literally, and rejects ambiguous profiles. `studentClassMembershipWhere` defines the class roster and verified-teacher filter shared by classroom and semester grade reads. Apply current visibility settings after provider requests complete; hidden periods must be removed before building student-facing data.

Account verification, teacher activation, and recovery share `lib/auth/tokens.ts` and `lib/auth/email.ts`. Token functions retain their separate signing secrets, purposes, expiration, identity checks, and password/session fingerprints. Email templates use the common SMTP/Resend delivery in `lib/email.ts`. The older student-update link format remains in its admission service so existing links stay valid.

Management create/edit pages use `PortalFormPage` from `components/portal/page-header.tsx`. Branch offerings and program subjects use `PortalAssignmentForm`; configure its item labels, locked selections, server action and destination in the route page. Shared form feedback belongs in `components/portal/toasts.tsx`, where save notifications, draft retention and successful navigation can be maintained together. Route `page.tsx`, `layout.tsx`, `loading.tsx` and `actions.ts` files retain their Next.js routing and server boundaries.

The public **Last school attended** step searches saved school names, IDs, and locations through `last-school-catalog.ts`. Selecting a school fills its school details and address; choose **Other** to enter a school that is missing. The public catalog contains institution metadata only. The internal selection field `last_school_record_id` identifies a `last_schools` record, while `last_school_id` remains the institution's external School ID. The server reloads selected school details rather than trusting submitted copies.

`last-school-store.ts` reuses matching school metadata and full addresses across submissions, portal edits, and secure student updates. Human text matches regardless of casing or spacing; identifiers preserve their case. Different campuses remain separate. School year, attained level, and graduation date belong to each admission application. Shared school records and addresses are preserved when a student edits details; unmatched school details create a separate record. Serializable transactions retry concurrency conflicts up to three times. This feature requires no schema migration and retains existing school records.

Portal tables use `components/portal/data-table.tsx`; admissions and students share their columns in `student-columns.tsx`. Manage Students uses `InteractivePortalTable` for search across student numbers, names, program, branch, year level and contacts, sortable headings, sticky headers and 10/25/50-row pagination. It initially shows the most recently approved records and keeps compact rows. Manage Employees puts search, Status and Role controls in the same toolbar, wrapping on smaller screens. Shared interactive tables accept optional `toolbarControls` and `cellClassName` props while retaining their existing defaults. List and edit pages load admission options through `lib/portal/admission-options.ts`. Update common table markup or queries in these modules instead of copying it into each page.

`components/portal/interactive-table.tsx` adds optional client interaction around the same table markup. Define its function-valued columns and search accessors in a client wrapper, such as `app/portal/programs/programs-table.tsx`, and pass serialized rows from the server page. Filtering, sorting, and pagination run locally after the catalog is loaded; `lib/table.ts` contains their reusable rules.

Shared utilities live directly under `lib`, and reusable contracts live under `lib/types`. Other features can import validators from `@/lib/validation`, form readers and date formatters from `@/lib/utils`, and catalog types from `@/lib/types/catalog`. `readFormValue` preserves whitespace; `readFormText` trims it. `readFormFields` trims by default; pass `{ trim: false }` for raw values such as passwords and tokens.

Import `normalizeEmail`, `normalizeName`, `getInitials`, `formatRoleLabel`, `formatProgramType`, `isActivePath`, and object/value helpers directly from `@/lib/utils`; they work in client and server code without importing authentication or admission services. `parseId` retains arbitrary-precision database IDs, including zero; `parsePositiveSafeInteger` accepts only positive safe integers. `getRecordValue` reads ordered field aliases while preserving zero and false. Spreadsheet `normalizeHeader` removes punctuation; payload `normalizeKey` removes only spaces, underscores, and hyphens.

The admission confirmation imports QR drawing and canvas text wrapping from `lib/qr-code.ts`. This module preserves the existing encoder's eight-digit numeric format and is covered by decoding and error-correction tests.

Call `sendEmail({ to, subject, html, text })` from server code to deliver any notification through the configured provider. SMTP still takes precedence when configured. Feature templates belong with their feature; `student-update-email.ts` handles student link content, escaping, and URL rules before passing the message to `lib/email.ts`.

## Checks

User-entered text is normalized on the server before validation and database writes. `sanitizeInputText` in `lib/utils.ts` removes markup, embedded script/style content, control and invisible formatting characters, trims whitespace, and uses Unicode NFC. `capitalizeInputText` also capitalizes each word's first letter while retaining acronyms and internal name capitalization. Admission submissions, secure updates, portal add/edit, spreadsheet imports, class assignments, and program content use these shared rules. Topic and pathway lists normalize each line separately. Emails remain lowercase; credentials, signed tokens, IDs, codes, dates, enums, phone/postal/house numbers, and case-sensitive URLs retain their required formats. Existing records are normalized when edited; no bulk data rewrite is required.

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

On PowerShell systems with script execution disabled, use `npm.cmd` and `npx.cmd`. Production builds download the configured Google fonts and need access to Google Fonts. `npm test` discovers every `tests/*.test.ts` file. Tests cover shared utility rules, wizard branching and resets, profile mapping and validation, record serialization, current and legacy passwords, email templates/provider selection, and grades service responses. Email and grades providers are mocked; tests do not send messages or access the database.

The optional seed runner loads enabled modules from `prisma/seed-data` in order. If modules are added, review their `down` handlers before running `npx prisma db seed`: the runner executes those handlers before `up`. With no modules configured, it exits without changing records. Generated Prisma files, build output, and environment files are ignored by Git.
