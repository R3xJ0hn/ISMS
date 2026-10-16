import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as imagePolicy from "../lib/users/image";
import type * as imageService from "../lib/users/profile-image";

const code = ts.transpileModule(readFileSync(new URL("../lib/users/profile-image.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
}).outputText;
class SafeUploadError extends Error {}
const photoUrl = "https://res.cloudinary.com/test/image/upload/profile.png";

function harness(options: { referencedBy?: "user" | "student" | "employee"; unavailable?: boolean; uploadError?: Error; cleanupFailure?: boolean } = {}) {
  const uploads: Array<{ file: File; scope: string }> = [], deletes: unknown[][] = [], reads: string[] = [];
  const database = Object.fromEntries(["user", "employee", "student"].map((table) => [table, {
    findFirst: async (query: { where: { userImage: string }; select: { id: boolean } }) => {
      reads.push(table); assert.equal(query.where.userImage, photoUrl); assert.deepEqual(Object.keys(query.select), ["id"]);
      if (options.unavailable) throw new Error("Private connection details");
      return options.referencedBy === table ? { id: 1n } : null;
    },
  }]));
  const modules: Record<string, unknown> = {
    "server-only": {}, "./image": imagePolicy, "@/lib/prisma": { prisma: database },
    "@/lib/cloudinary": { CloudinaryUploadError: SafeUploadError,
      uploadProfileImage: async (file: File, scope: string) => { uploads.push({ file, scope }); if (options.uploadError) throw options.uploadError; return { secureUrl: photoUrl, publicId: "test-photo" }; },
      deleteProfileImage: async (...args: unknown[]) => { deletes.push(args); if (options.cleanupFailure) throw new Error("Private provider details"); },
    },
  };
  const loaded = { exports: {} };
  runInNewContext(code, { module: loaded, exports: loaded.exports, File, require: (name: string) => {
    assert.ok(name in modules, name); return modules[name];
  } });
  return { service: loaded.exports as typeof imageService, uploads, deletes, reads };
}
function photo() { return new File(["synthetic"], "photo.png", { type: "image/png" }); }

test("blank profile inputs preserve photos, explicit removal yields null, and raw URL fields cannot replace photos", async () => {
  const h = harness();
  const data = new FormData(); data.set("userImage", "https://forged.example/photo.png");
  assert.equal((await h.service.prepareProfileImage(data, "employee:1")).success, true);
  assert.equal((await h.service.prepareProfileImage(data, "employee:1") as { change?: unknown }).change, undefined);
  data.set("image", new File([], ""));
  assert.equal((await h.service.prepareProfileImage(data, "employee:1") as { change?: unknown }).change, undefined);
  data.set("removeImage", "true");
  const removed = await h.service.prepareProfileImage(data, "employee:1");
  assert.ok(removed.success); assert.equal(removed.change?.value, null); assert.equal(h.uploads.length, 0);
});

test("unselected file inputs survive the installed React and Next multipart action transport as an optional photo", async () => {
  // Next's Node action handler uses Busboy. Its missing filename becomes the
  // literal filename "undefined" when React reconstructs the server-side File.
  const transported = JSON.parse(execFileSync(process.execPath, ["--conditions=react-server", "--input-type=commonjs", "-e", `
    const { encodeReply } = require('next/dist/compiled/react-server-dom-turbopack/client.browser');
    const { decodeReplyFromBusboy } = require('next/dist/compiled/react-server-dom-turbopack/server.node');
    const busboy = require('next/dist/compiled/busboy');
    const { Readable } = require('node:stream');
    (async () => {
      const data = new FormData();
      data.set('image', new File([], '', { type: 'application/octet-stream' }));
      const encoded = await encodeReply([null, data]);
      const wire = new Response(encoded);
      const parser = busboy({ headers: { 'content-type': wire.headers.get('content-type') } });
      const decoded = decodeReplyFromBusboy(parser, {});
      Readable.fromWeb(wire.body).pipe(parser);
      const args = await decoded;
      const image = args[1].get('image');
      process.stdout.write(JSON.stringify({ name: image.name, type: image.type, size: image.size }));
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `], { cwd: process.cwd(), encoding: "utf8", timeout: 10_000 })) as { name: string; type: string; size: number };
  assert.equal(transported.size, 0);
  const h = harness(), input = new FormData();
  input.set("image", new File([], transported.name, { type: transported.type }));
  const preserved = await h.service.prepareProfileImage(input, "student:1");
  assert.ok(preserved.success);
  assert.equal(preserved.change, undefined);
  input.set("removeImage", "true");
  const removed = await h.service.prepareProfileImage(input, "student:1");
  assert.ok(removed.success);
  assert.equal(removed.change?.value, null);
  assert.equal(h.uploads.length, 0);
});

test("zero-byte file placeholders never replace existing photos or trigger uploads regardless of transport filename", async () => {
  for (const name of ["", "undefined", "blob", "named-empty.png"]) {
    for (const type of ["", "application/octet-stream", "image/png"]) {
      const h = harness(), input = new FormData();
      input.set("image", new File([], name, { type }));
      const result = await h.service.prepareProfileImage(input, "employee:1");
      assert.ok(result.success, `${name}: ${type}`);
      assert.equal(result.change, undefined);
      assert.equal(h.uploads.length, 0);
    }
  }
});

test("profile photo parsing rejects duplicate fields, text URLs, invalid removals and conflicting file/removal requests", async () => {
  for (const kind of ["duplicate", "text", "remove", "both", "duplicate-remove", "unsupported", "oversize"]) {
    const h = harness(), data = new FormData();
    data.set("image", photo());
    if (kind === "duplicate") data.append("image", photo());
    if (kind === "text") data.set("image", "https://untrusted.example/photo.png");
    if (kind === "remove") data.set("removeImage", "false");
    if (kind === "both") data.set("removeImage", "true");
    if (kind === "duplicate-remove") { data.delete("image"); data.append("removeImage", "true"); data.append("removeImage", "true"); }
    if (kind === "unsupported") data.set("image", new File(["<svg>"], "image.svg", { type: "image/svg+xml" }));
    if (kind === "oversize") data.set("image", new File([new Uint8Array(imagePolicy.userImageMaxBytes + 1)], "large.png", { type: "image/png" }));
    const result = await h.service.prepareProfileImage(data, "student:1");
    assert.equal(result.success, false, kind); assert.equal(h.uploads.length, 0, kind);
  }
});

test("prepared images use the authorized scope and provider URL while preserving only safe upload errors", async () => {
  const data = new FormData(); data.set("image", photo());
  const h = harness(), result = await h.service.prepareProfileImage(data, "student:9007199254740993");
  assert.ok(result.success); assert.equal(result.change?.value, photoUrl);
  assert.equal(result.change?.upload?.scope, "student:9007199254740993");
  for (const error of [new SafeUploadError("Upload configuration unavailable."), new Error("PRIVATE secret")]) {
    const failure = await harness({ uploadError: error }).service.prepareProfileImage(data, "student:1");
    assert.equal(failure.success, false); assert.doesNotMatch(JSON.stringify(failure), /PRIVATE|secret/);
    if (error instanceof SafeUploadError) assert.equal(failure.message, error.message);
  }
});

test("rollback removes only a confirmed unused new image and preserves images referenced by any record or uncertain database state", async () => {
  const change = { value: photoUrl, upload: { secureUrl: photoUrl, publicId: "test-photo", scope: "employee:1" } };
  const h = harness(); await h.service.cleanupProfileImage(change);
  assert.deepEqual(h.deletes, [["test-photo", "employee:1"]]);
  for (const referencedBy of ["user", "employee", "student"] as const) {
    const used = harness({ referencedBy }); await used.service.cleanupProfileImage(change); assert.equal(used.deletes.length, 0);
  }
  const uncertain = harness({ unavailable: true }); await uncertain.service.cleanupProfileImage(change); assert.equal(uncertain.deletes.length, 0);
  const failedCleanup = harness({ cleanupFailure: true }); await failedCleanup.service.cleanupProfileImage(change); assert.equal(failedCleanup.deletes.length, 1);
  const empty = harness(); await empty.service.cleanupProfileImage(undefined); await empty.service.cleanupProfileImage({ value: null });
  assert.equal(empty.reads.length, 0); assert.equal(empty.deletes.length, 0);
});
