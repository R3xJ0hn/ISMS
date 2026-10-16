import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

import { ProfileIdentityError } from "../lib/users/profiles";
import type * as imageService from "../lib/admission/student-profile-image";

const code = ts.transpileModule(readFileSync(new URL("../lib/admission/student-profile-image.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
}).outputText;
const imageUrl = "https://res.cloudinary.com/test/image/upload/student.png";
const studentId = 9007199254740993n;

function harness(options: { account?: { userImage: string | null } | null; error?: Error } = {}) {
  const calls: Array<{ kind: string; id: bigint }> = [];
  const database = Object.freeze({});
  const modules: Record<string, unknown> = {
    "server-only": {},
    "@/lib/prisma": { prisma: database },
    "@/lib/users/profiles": {
      ProfileIdentityError,
      getUserForProfile: async (client: unknown, reference: { kind: string; id: bigint }) => {
        assert.equal(client, database);
        calls.push(reference);
        if (options.error) throw options.error;
        return options.account ?? null;
      },
    },
  };
  const loaded = { exports: {} };
  runInNewContext(code, { module: loaded, exports: loaded.exports, require: (name: string) => {
    assert.ok(name in modules, `Unexpected photo lookup dependency: ${name}`);
    return modules[name];
  } });
  return { service: loaded.exports as typeof imageService, calls };
}

test("the standalone student photo export uses the saved profile photo without querying an account", async () => {
  const h = harness({ error: new Error("Account lookup should not run") });
  assert.equal(typeof h.service.getStudentProfileImage, "function");
  assert.equal(await h.service.getStudentProfileImage({ id: studentId, userImage: imageUrl }), imageUrl);
  assert.equal(h.calls.length, 0);
});

test("a student without a profile photo inherits the uniquely linked account photo using the exact student ID", async () => {
  const h = harness({ account: { userImage: imageUrl } });
  assert.equal(await h.service.getStudentProfileImage({ id: studentId, userImage: null }), imageUrl);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].kind, "student");
  assert.equal(h.calls[0].id, studentId);
});

test("students without an account or account photo render with no photo", async () => {
  for (const account of [null, { userImage: null }]) {
    const h = harness({ account });
    assert.equal(await h.service.getStudentProfileImage({ id: studentId }), null);
    assert.equal(h.calls.length, 1);
  }
});

test("ambiguous student-account associations omit the photo instead of blocking the edit page", async () => {
  const h = harness({ error: new ProfileIdentityError() });
  assert.equal(await h.service.getStudentProfileImage({ id: studentId }), null);
  assert.equal(h.calls.length, 1);
});

test("unexpected database failures remain visible instead of being treated as a missing photo", async () => {
  const error = new Error("Synthetic database failure");
  const h = harness({ error });
  await assert.rejects(h.service.getStudentProfileImage({ id: studentId }), (caught) => caught === error);
});
