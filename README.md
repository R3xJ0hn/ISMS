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

## Architecture

```text
app/
  (public)/                 Public pages and admission workflow
    admission/components/  Wizard, shared fields, dynamic steps, review
    admission/update/      Student updates and password setup
  login/                   Authentication page and actions
  portal/                  Authenticated pages
    admission/             Shared add/edit/import forms, modals, controls, actions
components/
  public/                  Homepage sections
  auth/                    Shared password setup form
  ui/                      Used UI primitives
  app-sidebar*.tsx         Server data and client navigation
hooks/                     Shared browser subscriptions
lib/
  admission/
    applications.ts        Public submission and student verification
    admin.ts               Portal admission operations and spreadsheet imports
    catalog.ts             Branch and program queries, branch cache
    records.ts             Prisma selections, inferred query types, serialization
    student-update.ts      Signed links and transactional record updates
    student-password-reset.ts  Password setup and token consumption
    submission-store.ts    Transactional admission persistence
    validation.ts          Shared date, ID, contact, and school year validation
    types.ts, constants.ts Shared contracts and program rules
    resend.ts              SMTP/Resend delivery
  auth.ts                  Password hashing, sessions, role guards
  prisma.ts                Database client lifecycle
  student-grades.ts        Grades retrieval and transformation
  encryption.ts            Grades encryption
  utils.ts                 Shared formatting and class utilities
prisma/                    Database schema and optional seed runner
tests/                    Validation and record serialization tests
```

Pages compose queries and UI. Route `actions.ts` files define explicit async server boundaries and delegate admission business logic to `lib/admission`. Client components call those boundaries; imports of server record types use `import type`. Feature services do not import route or UI modules.

Public form fields live in `form-sections.tsx` and reuse `form-fields.tsx`; student updates reuse the same field metadata. Portal add/edit forms share their definitions in `admitted-student-form.tsx`, with modal and control behavior in `admission-ui.tsx`. Dynamic verification/program steps stay separate because they have their own asynchronous state.

`records.ts` defines each Prisma selection once and derives query types from it. Update selections and serialization together when adding stored fields. Group components by feature and extract shared code when it has multiple consumers.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

On PowerShell systems with script execution disabled, use `npm.cmd` and `npx.cmd`. Production builds download the configured Google fonts and need access to Google Fonts. Tests cover calendar validation, database ID precision, contact rules, and admission record serialization without database access.

The optional seed runner loads modules from `prisma/seed-data` in order. There are currently no seed modules; `npx prisma db seed` reports that and exits without changing database records. Generated Prisma files, build output, and environment files are ignored by Git.
