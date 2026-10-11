# ISMS

Student Information Management System built with Next.js App Router, React, TypeScript, PostgreSQL, and Prisma. It includes public admissions, secure student record updates, portal access, admissions management, grades, and login history.

## Development

```sh
npm ci
npm run dev
```

Configure `.env` first. `dev` and `build` generate the Prisma client automatically. The database must already match `prisma/schema.prisma`; apply schema changes separately against your intended database.

| Configuration | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection |
| `JWT_SECRET` | Session signing secret, at least 32 bytes |
| `SECRET_KEY` | Grades encryption secret, at least 32 bytes |
| `APP_URL` | Public base URL for student update links; HTTPS in production |
| `STUDENT_UPDATE_LINK_SECRET` | Update link signing secret; falls back to `RESEND_API_KEY` |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Email delivery through Resend |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL` | Optional SMTP delivery; takes precedence when `SMTP_HOST` is set |
| `STUDENT_GRADES_APPS_SCRIPT_URL` | External grades endpoint |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | Optional analytics |

`NEXT_PUBLIC_APP_URL` and `VERCEL_URL` are fallback base URLs when `APP_URL` is absent. Secrets stay in server modules and local environment configuration.

## Public program catalog

The homepage, Programs page, and course detail pages read their catalog from PostgreSQL. `program_groups` stores category descriptions, education levels, pathway headings, and display order. `programs` stores both admission data and public course details, including slugs, notes, overviews, topics, pathways, and category membership. Its `public_title` and `public_code` fields preserve public display names while keeping existing admission labels and codes intact.

Public entries require `slug`, `publicTitle`, `publicCode`, `overview`, and `groupId`. Programs without these fields remain valid for admission and are excluded from public listings. Update course content directly in these database records; display icons are selected in `lib/public/programs.ts`. Branch availability comes from `sections`, independently of public catalog membership.

Super admins can open **Management → Programs** at `/portal/programs` and edit existing programs, including admission names and codes, program type, public content, category, and display order. Each topic or pathway occupies one line. Choosing **Not listed publicly** removes the public category while retaining the course content and admission record. The list, edit page, and save action require a super admin session. Saves refresh the catalog and both the old and new course URLs. No database migration is needed.

The Programs table has a bounded scroll area with a sticky header. Its search matches names, codes, types, categories, and public-page status across the complete loaded catalog. Click a column heading to toggle ascending or descending order. Pagination defaults to 10 rows, with 25 and 50 available; searching, sorting, and changing the page size return to the first page.

This checkout contains the Prisma schema and an optional seed runner, with no configured seed modules or catalog SQL scripts. Set up a new database separately and populate its catalog records before serving public pages. Generating the Prisma client does not create tables or seed data.

## Architecture

```text
app/
  (public)/                 Public pages; layout owns navbar and footer
    admission/components/  Field schema, wizard reducer, steps, review, confirmation
    admission/update/      Student updates and password setup
  login/                   Authentication page and actions
  portal/                  Authenticated pages
    admission/             Shared add/edit/import forms, modals, controls, actions
    programs/              Super admin program list and course editor
components/
  public/                  Homepage sections
  auth/                    Shared password setup and unavailable-link UI
  portal/                  Shared tables, interactive search/sort/paging, page header, columns
  ui/                      Used UI primitives
  app-sidebar*.tsx         Server data and client navigation
hooks/                     Shared browser subscriptions
lib/
  admission/
    applications.ts        Public submission and student verification
    admin.ts               Portal admission operations and spreadsheet imports
    catalog.ts             Branch and program queries, branch cache
    records.ts             Prisma selections, inferred query types, serialization
    student-fields.ts      Submission/edit field names and profile validation
    profile-data.ts        Shared student, address, guardian, and school write data
    student-update.ts      Signed links and transactional record updates
    student-password-reset.ts  Password setup and token consumption
    submission-store.ts    Transactional admission persistence
    constants.ts           Admission applicant labels and program rules
    student-update-email.ts  Student update email template and sending wrapper
  auth.ts                  Authentication, sessions, role guards; public auth exports
  auth/credentials.ts      Bcrypt and legacy scrypt password verification
  portal/admission-options.ts  Shared portal admission choices and ID serialization
  programs/
    admin.ts               Authorized program updates and page refreshes
    validation.ts          Program form contracts, validation, and write mapping
  public/
    programs.ts            Database catalog queries and public course mapping
    site.ts                School contact details and shared image URLs
  prisma.ts                Database client lifecycle
  types/
    catalog.ts             Reusable address, branch, program, and academic level types
    admission.ts           Admission workflow contracts and catalog aliases
  validation.ts            Shared date, contact, school year, and password validation
  qr-code.ts               Numeric QR encoding, drawing, and canvas text wrapping
  email.ts                 Reusable SMTP/Resend delivery
  student-grades.ts        Grades retrieval and transformation
  table.ts                 Shared search, stable sorting, and pagination helpers
  encryption.ts            Grades encryption
  utils.ts                 Text, form, date, value/ID, display, navigation, and class helpers
prisma/                    Database schema and optional seed runner
tests/                     Admission, wizard, credentials, and grades regressions
```

Pages compose queries and UI. Route `actions.ts` files define explicit async server boundaries and delegate admission business logic to `lib/admission`. Client components call those boundaries; imports of server record types use `import type`. Feature services do not import route or UI modules.

Public form fields live in `form-schema.ts` and render through `form-fields.tsx` and `form-sections.tsx`. The same schema supplies empty values, step requirements, and student update fields. `wizard-state.ts` owns state transitions and dependency resets; `admission-wizard.tsx` connects them to server actions. `admission-confirmation.tsx` handles the slip and QR code. Portal add/edit forms share their definitions in `admitted-student-form.tsx`, with modal and control behavior in `admission-ui.tsx`.

`student-fields.ts` maps public submission keys to saved profile fields. Submission, admin edits, and secure updates reuse the builders in `profile-data.ts`. `records.ts` defines Prisma selections and saved profile serialization, including the edit/review mapping. When adding a stored field, update its schema, field map, UI definition, and serialization together.

Portal tables use `components/portal/data-table.tsx`; admissions and students share their columns in `student-columns.tsx`. List and edit pages load admission options through `lib/portal/admission-options.ts`. Update common table markup or queries in these modules instead of copying it into each page.

`components/portal/interactive-table.tsx` adds optional client interaction around the same table markup. Define its function-valued columns and search accessors in a client wrapper, such as `app/portal/programs/programs-table.tsx`, and pass serialized rows from the server page. Filtering, sorting, and pagination run locally after the catalog is loaded; `lib/table.ts` contains their reusable rules.

Shared utilities live directly under `lib`, and reusable contracts live under `lib/types`. Other features can import validators from `@/lib/validation`, form readers and date formatters from `@/lib/utils`, and catalog types from `@/lib/types/catalog`. `readFormValue` preserves whitespace; `readFormText` trims it. `readFormFields` trims by default; pass `{ trim: false }` for raw values such as passwords and tokens.

Import `normalizeEmail`, `normalizeName`, `getInitials`, `formatRoleLabel`, `formatProgramType`, `isActivePath`, and object/value helpers directly from `@/lib/utils`; they work in client and server code without importing authentication or admission services. `parseId` retains arbitrary-precision database IDs, including zero; `parsePositiveSafeInteger` accepts only positive safe integers. `getRecordValue` reads ordered field aliases while preserving zero and false. Spreadsheet `normalizeHeader` removes punctuation; payload `normalizeKey` removes only spaces, underscores, and hyphens.

The admission confirmation imports QR drawing and canvas text wrapping from `lib/qr-code.ts`. This module preserves the existing encoder's eight-digit numeric format and is covered by decoding and error-correction tests.

Call `sendEmail({ to, subject, html, text })` from server code to deliver any notification through the configured provider. SMTP still takes precedence when configured. Feature templates belong with their feature; `student-update-email.ts` handles student link content, escaping, and URL rules before passing the message to `lib/email.ts`.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

On PowerShell systems with script execution disabled, use `npm.cmd` and `npx.cmd`. Production builds download the configured Google fonts and need access to Google Fonts. `npm test` discovers every `tests/*.test.ts` file. Tests cover shared utility rules, wizard branching and resets, profile mapping and validation, record serialization, current and legacy passwords, email templates/provider selection, and grades service responses. Email and grades providers are mocked; tests do not send messages or access the database.

The optional seed runner loads enabled modules from `prisma/seed-data` in order. If modules are added, review their `down` handlers before running `npx prisma db seed`: the runner executes those handlers before `up`. With no modules configured, it exits without changing records. Generated Prisma files, build output, and environment files are ignored by Git.
