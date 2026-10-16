import assert from "node:assert/strict";
import * as crypto from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import type * as cloudinary from "../lib/cloudinary";
import * as imagePolicy from "../lib/users/image";

const code = ts.transpileModule(readFileSync(new URL("../lib/cloudinary.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
}).outputText;
const environment = { CLOUDINARY_CLOUD_NAME: "school-test", CLOUDINARY_API_KEY: "test-key", CLOUDINARY_API_SECRET: "private-test-secret" };
const userId = "12345678901234567890";
const prefix = `isms/profile-images/${crypto.createHash("sha256").update(userId).digest("hex")}/`;
const fixtureId = prefix + "bdb47753-2467-4d8c-b3e6-547a18e75641";
const imageTypeError = "Choose a JPEG, PNG, or WebP image.";
const uploadError = "The profile image could not be uploaded. Please try again.";
const cleanupError = "The unused profile image could not be removed.";
const configurationError = "Profile image uploads are not configured. Contact your administrator.";
const unavailableError = "Photo uploads are unavailable. Ask an administrator to check the Cloudinary configuration.";

function image(format: "png" | "jpeg" | "webp" = "png", mime?: string) {
  const header = format === "png" ? [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    : format === "jpeg" ? [0xff, 0xd8, 0xff, 0xe0] : [0x52, 0x49, 0x46, 0x46, 0x04, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];
  return new File([new Uint8Array(header)], "private student name.png", { type: mime ?? `image/${format}` });
}

function responseFor(form: FormData, overrides: Record<string, unknown> = {}, cloudName = environment.CLOUDINARY_CLOUD_NAME) {
  return {
    public_id: form.get("public_id"), resource_type: "image", type: "upload", version: 1_760_510_000, format: "png",
    secure_url: `https://res.cloudinary.com/${cloudName}/image/upload/v1760510000/${form.get("public_id")}.png`,
    ...overrides,
  };
}

function harness(options: {
  env?: Record<string, string | undefined>;
  respond?: (form: FormData, url: string) => Response | Promise<Response>;
} = {}) {
  const calls: { url: string; options: RequestInit; form: FormData }[] = [];
  const timeouts: number[] = [];
  const loaded = { exports: {} };
  runInNewContext(code, {
    module: loaded, exports: loaded.exports, process: { env: options.env ?? environment },
    URL, File, FormData, Uint8Array, Date,
    AbortSignal: { timeout: (ms: number) => { timeouts.push(ms); return AbortSignal.timeout(ms); } },
    fetch: async (url: string, requestOptions: RequestInit) => {
      const form = requestOptions.body as FormData;
      calls.push({ url, options: requestOptions, form });
      return options.respond ? options.respond(form, url) : Response.json(responseFor(form));
    },
    require: (name: string) => {
      if (name === "server-only") return {};
      if (name === "node:crypto") return crypto;
      if (name === "@/lib/users/image") return imagePolicy;
      throw new Error(`Unexpected module: ${name}`);
    },
  });
  return { service: loaded.exports as typeof cloudinary, calls, timeouts };
}

function verifySignedForm(form: FormData, secret = environment.CLOUDINARY_API_SECRET) {
  const signed = [...form.entries()].filter(([key]) => !["file", "api_key", "signature"].includes(key));
  const serialized = signed.sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("&");
  assert.equal(form.get("signature"), crypto.createHash("sha256").update(serialized + secret).digest("hex"));
  assert.match(form.get("timestamp") as string, /^\d{10,}$/);
  assert.ok(Math.abs(Number(form.get("timestamp")) - Math.floor(Date.now() / 1000)) < 3);
  assert.ok(![...form.values()].includes(secret), "The API secret is not sent in the request body.");
}

test("uploads use server-signed HTTPS multipart requests, an opaque user scope and fresh asset IDs", async () => {
  const subject = harness();
  const first = await subject.service.uploadProfileImage(image(), userId);
  const second = await subject.service.uploadProfileImage(image(), userId);
  assert.notEqual(first.publicId, second.publicId, "A failed save must never overwrite the previously saved avatar.");
  assert.ok(first.publicId.startsWith(prefix));
  assert.doesNotMatch(first.publicId, new RegExp(userId));
  const call = subject.calls[0];
  assert.equal(call.url, "https://api.cloudinary.com/v1_1/school-test/image/upload");
  assert.equal(call.options.method, "POST");
  assert.equal(call.options.redirect, "error");
  assert.equal(call.options.cache, "no-store");
  assert.ok(call.options.signal instanceof AbortSignal);
  assert.deepEqual(subject.timeouts, [20_000, 20_000]);
  assert.equal(call.form.get("api_key"), "test-key");
  assert.equal(call.form.get("overwrite"), "false");
  assert.equal(call.form.get("allowed_formats"), "jpg,jpeg,png,webp");
  assert.equal((call.form.get("file") as File).name, "profile-image");
  assert.equal(first.secureUrl, responseFor(call.form).secure_url);
  assert.deepEqual(Object.keys(first).sort(), ["publicId", "secureUrl"]);
  verifySignedForm(call.form);
});

test("JPEG, PNG and WebP require matching byte signatures and MIME types", async () => {
  const subject = harness();
  for (const format of ["jpeg", "png", "webp"] as const) await subject.service.uploadProfileImage(image(format), userId);
  assert.equal(subject.calls.length, 3);

  for (const file of [
    new File(["<svg><script>alert(1)</script></svg>"], "photo.png", { type: "image/png" }),
    new File(["not an image"], "photo.jpg", { type: "image/jpeg" }),
    image("png", "image/jpeg"), image("png", "application/octet-stream"),
    image("jpeg", "image/png"), image("webp", "image/svg+xml"),
    new File([new Uint8Array([0xff, 0xd8])], "truncated.jpg", { type: "image/jpeg" }),
    new File([], "empty.png", { type: "image/png" }),
    "https://attacker.example/avatar.png" as unknown as File,
  ]) {
    await assert.rejects(subject.service.uploadProfileImage(file, userId), { message: imageTypeError });
  }
  assert.equal(subject.calls.length, 3, "Rejected files never contact Cloudinary.");
});

test("the 5 MiB boundary is enforced before contacting the provider", async () => {
  const subject = harness();
  const png = image();
  await subject.service.uploadProfileImage(new File([png, new Uint8Array(5 * 1024 * 1024 - png.size)], "large.png", { type: "image/png" }), userId);
  await assert.rejects(subject.service.uploadProfileImage(new File([png, new Uint8Array(5 * 1024 * 1024)], "oversized.png", { type: "image/png" }), userId), {
    message: "The profile image must be 5 MB or smaller.",
  });
  assert.equal(subject.calls.length, 1);
});

test("CLOUDINARY_URL supports encoded credentials and takes precedence over individual settings", async () => {
  const secret = "test:private/@&secret";
  const subject = harness({
    env: { ...environment, CLOUDINARY_URL: `cloudinary://url-key:${encodeURIComponent(secret)}@url-cloud` },
    respond: (form) => Response.json(responseFor(form, {}, "url-cloud")),
  });
  await subject.service.uploadProfileImage(image(), userId);
  assert.equal(subject.calls[0].url, "https://api.cloudinary.com/v1_1/url-cloud/image/upload");
  assert.equal(subject.calls[0].form.get("api_key"), "url-key");
  verifySignedForm(subject.calls[0].form, secret);
});

test("missing and malformed configuration produces a useful error without disclosing credentials or making requests", async () => {
  for (const env of [
    {}, { CLOUDINARY_CLOUD_NAME: "school-test" }, { ...environment, CLOUDINARY_API_KEY: "" },
    { ...environment, CLOUDINARY_CLOUD_NAME: "evil.example/path" }, { ...environment, CLOUDINARY_API_SECRET: "private\nsecret" },
    { CLOUDINARY_URL: "https://url-key:private-secret@attacker.example" },
    { CLOUDINARY_URL: "cloudinary://url-key:private-secret@school-test:443" },
    { CLOUDINARY_URL: "cloudinary://url-key:private-secret@school-test/path" },
    { CLOUDINARY_URL: "cloudinary://url-key:private-secret@school-test?query=true" },
    { CLOUDINARY_URL: "cloudinary://url-key:private-secret@school-test#fragment" },
    { CLOUDINARY_URL: "cloudinary://url-key:%INVALID@school-test" },
  ]) {
    const subject = harness({ env });
    await assert.rejects(subject.service.uploadProfileImage(image(), userId), { message: configurationError });
    assert.equal(subject.calls.length, 0);
  }
});

test("invalid target user IDs fail before a network request", async () => {
  const subject = harness();
  for (const id of ["", " 123", "123 ", " ", "a".repeat(257), null as unknown as string]) {
    await assert.rejects(subject.service.uploadProfileImage(image(), id), { message: "A valid user is required to upload a profile image." });
  }
  assert.equal(subject.calls.length, 0);
});

test("provider failures, invalid JSON, network errors and timeouts expose only a safe upload error", async () => {
  for (const respond of [
    () => new Response("private-secret", { status: 429 }),
    () => new Response("private-secret", { status: 503 }),
    () => new Response("not json"),
    () => Response.json(null), () => Response.json([]),
    () => { throw new Error("private-secret in network error"); },
    () => { throw new DOMException("private-secret in timeout", "TimeoutError"); },
  ]) {
    const subject = harness({ respond });
    await assert.rejects(subject.service.uploadProfileImage(image(), userId), (error: unknown) => {
      assert.ok(error instanceof subject.service.CloudinaryUploadError);
      assert.equal(error.message, uploadError);
      return true;
    });
  }
});

test("authentication failures show an actionable configuration message without reading provider details", async () => {
  for (const status of [401, 403]) {
    let providerBodyRead = false;
    const subject = harness({ respond: () => {
      const response = new Response("private account details and signing parameters", { status });
      response.json = async () => { providerBodyRead = true; throw new Error("Provider details must not be read."); };
      response.text = async () => { providerBodyRead = true; throw new Error("Provider details must not be read."); };
      return response;
    } });
    await assert.rejects(subject.service.uploadProfileImage(image(), userId), (error: unknown) => {
      assert.ok(error instanceof subject.service.CloudinaryUploadError);
      assert.equal(error.message, unavailableError);
      return true;
    });
    assert.equal(providerBodyRead, false);
  }
});

test("upload responses must identify the exact uploaded image in this configured Cloudinary account", async () => {
  for (const overrides of [
    { public_id: "some-other-image" }, { resource_type: "raw" }, { type: "authenticated" }, { format: "svg" },
    { version: "1760510000" }, { version: -1 }, { version: 1.2 }, { secure_url: "javascript:alert(1)" },
    { secure_url: "https://attacker.example/avatar.png" },
    { secure_url: "https://res.cloudinary.com.attacker.example/avatar.png" },
    { secure_url: "http://res.cloudinary.com/school-test/image/upload/avatar.png" },
  ]) {
    const subject = harness({ respond: (form) => Response.json(responseFor(form, overrides)) });
    await assert.rejects(subject.service.uploadProfileImage(image(), userId), { message: uploadError });
  }
  for (const mutate of [
    (url: string) => url.replace("school-test/", "another-account/"),
    (url: string) => url.replace("/image/upload/", "/raw/upload/"),
    (url: string) => url.replace("v1760510000/", "v1760510001/"),
    (url: string) => url + "?download=private",
    (url: string) => url + "#fragment",
    (url: string) => url.replace("res.cloudinary.com", "user:password@res.cloudinary.com"),
  ]) {
    const subject = harness({ respond: (form) => {
      const result = responseFor(form);
      return Response.json({ ...result, secure_url: mutate(result.secure_url) });
    } });
    await assert.rejects(subject.service.uploadProfileImage(image(), userId), { message: uploadError });
  }
});

test("cleanup signs a destroy request only for app-generated images belonging to the target user", async () => {
  const subject = harness({ respond: () => Response.json({ result: "ok" }) });
  await subject.service.deleteProfileImage(fixtureId, userId);
  const call = subject.calls[0];
  assert.equal(call.url, "https://api.cloudinary.com/v1_1/school-test/image/destroy");
  assert.equal(call.form.get("public_id"), fixtureId);
  assert.equal(call.form.get("invalidate"), "true");
  assert.equal(call.form.has("file"), false);
  verifySignedForm(call.form);
  for (const invalidId of [
    "https://res.cloudinary.com/school-test/image/upload/photo.png", "other-image", fixtureId + ".png",
    prefix + "../../someone-else", prefix + "00000000-0000-0000-0000-000000000000",
    fixtureId.replace(prefix, `isms/profile-images/${"a".repeat(64)}/`), null as unknown as string,
  ]) {
    await assert.rejects(subject.service.deleteProfileImage(invalidId, userId), { message: cleanupError });
  }
  assert.equal(subject.calls.length, 1);
});

test("cleanup treats already-removed images as success and masks provider failures", async () => {
  await harness({ respond: () => Response.json({ result: "not found" }) }).service.deleteProfileImage(fixtureId, userId);
  for (const respond of [
    () => new Response("private-secret", { status: 401 }),
    () => new Response("private-secret", { status: 403 }),
    () => Response.json({ result: "private-secret" }),
    () => { throw new Error("private-secret"); },
  ]) {
    await assert.rejects(harness({ respond }).service.deleteProfileImage(fixtureId, userId), { message: cleanupError });
  }
});
