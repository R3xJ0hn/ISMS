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
components/
  public/                  Homepage sections
  auth/                    Shared password setup and unavailable-link UI
  portal/                  Typed table, student columns, page header, grade skeleton
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
    validation.ts          Shared date, ID, contact, and school year validation
    types.ts, constants.ts Shared contracts and program rules
    resend.ts              SMTP/Resend delivery
  auth.ts                  Authentication, sessions, role guards; public auth exports
  auth/credentials.ts      Email normalization, bcrypt and legacy scrypt verification
  portal/admission-options.ts  Shared portal admission choices and ID serialization
  public/
    programs.ts            Database catalog queries and public course mapping
    site.ts                School contact details and shared image URLs
  prisma.ts                Database client lifecycle
  student-grades.ts        Grades retrieval and transformation
  encryption.ts            Grades encryption
  utils.ts                 Shared formatting and class utilities
prisma/                    Database schema and optional seed runner
tests/                     Admission, wizard, credentials, and grades regressions
```

Pages compose queries and UI. Route `actions.ts` files define explicit async server boundaries and delegate admission business logic to `lib/admission`. Client components call those boundaries; imports of server record types use `import type`. Feature services do not import route or UI modules.

Public form fields live in `form-schema.ts` and render through `form-fields.tsx` and `form-sections.tsx`. The same schema supplies empty values, step requirements, and student update fields. `wizard-state.ts` owns state transitions and dependency resets; `admission-wizard.tsx` connects them to server actions. `admission-confirmation.tsx` handles the slip and QR code. Portal add/edit forms share their definitions in `admitted-student-form.tsx`, with modal and control behavior in `admission-ui.tsx`.

`student-fields.ts` maps public submission keys to saved profile fields. Submission, admin edits, and secure updates reuse the builders in `profile-data.ts`. `records.ts` defines Prisma selections and saved profile serialization, including the edit/review mapping. When adding a stored field, update its schema, field map, UI definition, and serialization together.

Portal tables use `components/portal/data-table.tsx`; admissions and students share their columns in `student-columns.tsx`. List and edit pages load admission options through `lib/portal/admission-options.ts`. Update common table markup or queries in these modules instead of copying it into each page.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

On PowerShell systems with script execution disabled, use `npm.cmd` and `npx.cmd`. Production builds download the configured Google fonts and need access to Google Fonts. `npm test` discovers every `tests/*.test.ts` file. Tests cover wizard branching and resets, profile mapping and validation, record serialization, current and legacy passwords, and grades service responses without database access.

The optional seed runner loads enabled modules from `prisma/seed-data` in order. If modules are added, review their `down` handlers before running `npx prisma db seed`: the runner executes those handlers before `up`. With no modules configured, it exits without changing records. Generated Prisma files, build output, and environment files are ignored by Git.
