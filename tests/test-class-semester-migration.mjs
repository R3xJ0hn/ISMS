import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { config } from "dotenv";
import pg from "pg";

config({ quiet: true });

const schema = `isms_class_semester_test_${randomUUID().replaceAll("-", "")}`;
const migrationUrl = new URL("../prisma/sql/20261015_class_semester.sql", import.meta.url);
let stage = "configuration";
let checks = 0;

function verify(condition, message) {
  assert.ok(condition, message);
  checks += 1;
}

async function run() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const sql = await readFile(migrationUrl, "utf8");
  verify(/^\s*BEGIN;[\s\S]*COMMIT;\s*$/.test(sql), "Expected a transaction-wrapped migration.");
  // The fixture transaction owns the boundary so the migration can never commit
  // its temporary schema or touch the application tables in the public schema.
  const migration = sql.replace(/^\s*BEGIN;\s*/, "").replace(/\s*COMMIT;\s*$/, "");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000 });
  let transactionOpen = false;

  try {
    stage = "database connection";
    await client.connect();
    stage = "fixture setup";
    await client.query("BEGIN");
    transactionOpen = true;
    await client.query("SET LOCAL lock_timeout = '10s'; SET LOCAL statement_timeout = '60s'");
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET LOCAL search_path TO "${schema}", public`);
    await client.query(`
      CREATE TABLE "classes" (
        "id" BIGSERIAL PRIMARY KEY,
        "teacher_id" BIGINT NOT NULL,
        "branch_id" BIGINT,
        "school_year" TEXT NOT NULL,
        "section_name" TEXT NOT NULL,
        "year_level" TEXT NOT NULL,
        "program_id" BIGINT,
        "subject_id" BIGINT,
        "subject_name" TEXT NOT NULL,
        "spreadsheet_url" TEXT,
        "prelim_visible" BOOLEAN NOT NULL DEFAULT true,
        "midterm_visible" BOOLEAN NOT NULL DEFAULT true,
        "prefinals_visible" BOOLEAN NOT NULL DEFAULT true,
        "finals_visible" BOOLEAN NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX "classes_assignment_key" ON "classes"(
        "teacher_id", "branch_id", "school_year", "section_name", "year_level", "program_id", "subject_id"
      );
      CREATE UNIQUE INDEX "classes_legacy_assignment_key" ON "classes"(
        "teacher_id", "branch_id", "school_year", "section_name", "year_level", "subject_name"
      ) WHERE "program_id" IS NULL;
      CREATE UNIQUE INDEX "classes_unassigned_assignment_key" ON "classes"(
        "teacher_id", "school_year", "section_name", "year_level", "subject_name"
      ) WHERE "branch_id" IS NULL;
      INSERT INTO "classes" (
        "teacher_id", "branch_id", "school_year", "section_name", "year_level", "program_id", "subject_id",
        "subject_name", "spreadsheet_url", "prelim_visible", "midterm_visible", "prefinals_visible", "finals_visible",
        "created_at", "updated_at"
      ) VALUES
        (10, 1, '2026-2027', 'A', 'FirstYear', 1, 1, 'Programming',
          'https://docs.google.com/spreadsheets/d/fixture-programming/edit', false, true, false, true,
          '2025-08-01T01:02:03Z', '2026-09-02T03:04:05Z'),
        (11, 1, '2026-2027', 'Legacy', 'SecondYear', NULL, NULL, 'History',
          'https://docs.google.com/spreadsheets/d/fixture-history/edit', true, false, true, false,
          '2025-08-02T01:02:03Z', '2026-09-03T03:04:05Z'),
        (12, NULL, '2026-2027', 'Unassigned', 'Grade11', NULL, NULL, 'Arts', NULL,
          false, false, true, true, '2025-08-03T01:02:03Z', '2026-09-04T03:04:05Z');
    `);

    const originalSnapshot = async () => (await client.query(`
      SELECT count(*)::int AS count,
        md5(jsonb_agg(to_jsonb(c) - 'semester' ORDER BY id)::text) AS fingerprint
      FROM "classes" c WHERE id <= 3
    `)).rows[0];
    const before = await originalSnapshot();
    const isolated = await client.query(`
      SELECT current_schema() AS schema,
        (SELECT n.nspname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          WHERE c.oid = 'classes'::regclass) AS table_schema,
        (SELECT count(*)::int FROM pg_catalog.pg_indexes WHERE schemaname = $1 AND indexname IN (
          'classes_assignment_key', 'classes_legacy_assignment_key', 'classes_unassigned_assignment_key'
        )) AS original_indexes
    `, [schema]);
    verify(isolated.rows[0].schema === schema && isolated.rows[0].table_schema === schema &&
      isolated.rows[0].original_indexes === 3, "Migration targets must resolve to the isolated fixture schema.");

    stage = "migration";
    await client.query(migration);
    assert.deepEqual(await originalSnapshot(), before, "All original fixture values and timestamps must remain unchanged.");
    checks += 1;
    const column = (await client.query(`
      SELECT is_nullable, column_default, udt_name, udt_schema FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'classes' AND column_name = 'semester'
    `, [schema])).rows[0];
    verify(column?.is_nullable === "YES" && column.column_default === null && column.udt_name === "Semester" &&
      column.udt_schema === schema, "Semester must be a nullable fixture enum with no guessed default.");
    const labels = (await client.query('SELECT enum_range(NULL::"Semester")::text[] AS labels')).rows[0].labels;
    assert.deepEqual(labels, ["FirstSemester", "SecondSemester"]);
    checks += 1;
    verify((await client.query('SELECT count(*)::int AS count FROM "classes" WHERE semester IS NULL')).rows[0].count === 3,
      "Every existing fixture class must retain an unassigned semester.");
    verify((await client.query(`SELECT count(*)::int AS count FROM pg_catalog.pg_indexes
      WHERE schemaname = $1 AND tablename = 'classes' AND indexname <> 'classes_pkey'`, [schema])).rows[0].count === 6,
    "All three assignment keys and their null-semester fallbacks must exist.");

    const insertFromSeed = (id, semester) => client.query(`
      INSERT INTO "classes" (
        "teacher_id", "branch_id", "school_year", "section_name", "year_level", "program_id", "subject_id",
        "subject_name", "spreadsheet_url", "prelim_visible", "midterm_visible", "prefinals_visible", "finals_visible",
        "created_at", "updated_at", "semester"
      ) SELECT
        "teacher_id", "branch_id", "school_year", "section_name", "year_level", "program_id", "subject_id",
        "subject_name", "spreadsheet_url", "prelim_visible", "midterm_visible", "prefinals_visible", "finals_visible",
        "created_at", "updated_at", $2::"Semester"
      FROM "classes" WHERE id = $1 RETURNING id
    `, [id, semester]);

    async function expectRejected(operation, code, constraint) {
      await client.query("SAVEPOINT expected_failure");
      let failure;
      try {
        await operation();
      } catch (error) {
        failure = error;
      } finally {
        await client.query("ROLLBACK TO SAVEPOINT expected_failure");
        await client.query("RELEASE SAVEPOINT expected_failure");
      }
      verify(failure?.code === code && (!constraint || failure.constraint === constraint),
        "Expected validation or uniqueness rejection did not occur.");
    }

    stage = "semester and uniqueness checks";
    const assignments = [
      { id: 1, key: "classes_assignment_key", unsetKey: "classes_unset_semester_assignment_key" },
      { id: 2, key: "classes_legacy_assignment_key", unsetKey: "classes_legacy_unset_semester_assignment_key" },
      { id: 3, key: "classes_unassigned_assignment_key", unsetKey: "classes_unassigned_unset_semester_assignment_key" },
    ];
    for (const assignment of assignments) {
      const first = await insertFromSeed(assignment.id, "FirstSemester");
      const second = await insertFromSeed(assignment.id, "SecondSemester");
      verify(first.rowCount === 1 && second.rowCount === 1, "The same assignment must be allowed in separate semesters.");
      await expectRejected(() => insertFromSeed(assignment.id, "FirstSemester"), "23505", assignment.key);
      await expectRejected(() => insertFromSeed(assignment.id, "SecondSemester"), "23505", assignment.key);
      await expectRejected(() => insertFromSeed(assignment.id, null), "23505", assignment.unsetKey);
      await expectRejected(() => client.query('UPDATE "classes" SET semester = \'SecondSemester\' WHERE id = $1',
        [first.rows[0].id]), "23505", assignment.key);
    }
    await expectRejected(() => insertFromSeed(1, "ThirdSemester"), "22P02");
    assert.deepEqual(await originalSnapshot(), before, "Uniqueness checks must preserve every original fixture value.");
    checks += 1;

    stage = "rollback cleanup";
    await client.query("ROLLBACK");
    transactionOpen = false;
    const cleanup = await client.query("SELECT count(*)::int AS count FROM pg_catalog.pg_namespace WHERE nspname = $1", [schema]);
    verify(cleanup.rows[0].count === 0, "The temporary fixture schema must be removed by rollback.");
    console.log(JSON.stringify({ passed: true, checks, temporarySchemaRemoved: true, applicationDataUntouched: true }));
  } finally {
    if (transactionOpen) await client.query("ROLLBACK").catch(() => {});
    await client.end();
  }
}

run().catch((error) => {
  const code = typeof error?.code === "string" && /^[A-Z0-9_]+$/.test(error.code) ? ` (${error.code})` : "";
  // Never print a connection string, database error detail, SQL parameters, or
  // records. The stage and PostgreSQL/Node error code are sufficient to triage.
  console.error(`Class semester migration verification failed during ${stage}${code}.`);
  process.exitCode = 1;
});
