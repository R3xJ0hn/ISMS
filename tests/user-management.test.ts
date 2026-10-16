import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { parseRecordId } from "../lib/utils";
import * as imagePolicy from "../lib/users/image";
import type * as userService from "../lib/users/admin";
import type { UserRole } from "../lib/generated/prisma/enums";
import type { Profile } from "../lib/users/profiles";

type User = {
  id: bigint; email: string; role: UserRole; userImage: string | null; emailVerified: boolean;
  createdAt: Date; updatedAt: Date; passwordHash: string; key: string; sessionVersion: number;
};
type Query = {
  where?: { id?: bigint; role?: { not: string }; userImage?: string | null };
  select?: Record<string, boolean>; data?: { userImage: string | null }; orderBy?: unknown;
};

const code = ts.transpileModule(readFileSync(new URL("../lib/users/admin.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
}).outputText;
const profileImageCode = ts.transpileModule(readFileSync(new URL("../lib/users/profile-image.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
}).outputText;
const initial = { success: false, message: "" };
const id = 9007199254740993n;
const uploaded = { secureUrl: "https://res.cloudinary.com/example/image/upload/v1/new-photo.png", publicId: "app-profile/new-photo" };
class SafeUploadError extends Error {}
class ProfileIdentityError extends Error { constructor() { super("This account changed while saving. Reload and try again."); } }

function user(overrides: Partial<User> = {}): User {
  return { id, email: "teacher@example.test", role: "teacher", userImage: "https://old.example.test/photo.png", emailVerified: true,
    createdAt: new Date("2026-10-01T00:00:00Z"), updatedAt: new Date("2026-10-02T00:00:00Z"),
    passwordHash: "PRIVATE-PASSWORD", key: "PRIVATE-KEY", sessionVersion: 8, ...overrides };
}
function form(values: Record<string, string | File> = {}) {
  const data = new FormData();
  data.set("userId", id.toString());
  data.set("image", new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "photo.png", { type: "image/png" }));
  for (const [name, value] of Object.entries(values)) data.set(name, value);
  return data;
}

function harness(options: {
  denied?: boolean; users?: User[]; uploadFailure?: boolean; cleanupFailure?: boolean; safeUploadFailure?: string;
  writeFailure?: boolean; committedBeforeFailure?: boolean; readBackFailure?: boolean;
  concurrentImage?: string; concurrentRole?: UserRole; loadFailure?: boolean;
  profile?: Profile; profileFailure?: boolean; profileWriteFailure?: boolean;
} = {}) {
  const users = structuredClone(options.users ?? [user()]);
  let profile = options.profile ? structuredClone(options.profile) : null;
  const calls: Array<{ method: string; query: Query }> = [];
  const events: string[] = [];
  const uploads: Array<{ file: File; userId: string }> = [];
  const deletes: Array<{ publicId: string; userId: string }> = [];
  const revalidated: Array<{ path: string; type?: string }> = [];
  function matches(row: User, query: Query) {
    const where = query.where ?? {};
    return (where.id === undefined || row.id === where.id) && (!where.role || row.role !== where.role.not)
      && (!Object.hasOwn(where, "userImage") || row.userImage === where.userImage);
  }
  const modules: Record<string, unknown> = {
    "server-only": {}, "./image": imagePolicy,
    "./profile-image": { cleanupProfileImage: async (change: { upload: { publicId: string; scope: string } }) => {
      events.push("cleanup"); deletes.push({ publicId: change.upload.publicId, userId: change.upload.scope });
    } },
    "./profiles": {
      ProfileIdentityError,
      getProfilesForUsers: async (_tx: unknown, accounts: User[]) => new Map(accounts.flatMap((account) => profile ? [[account.id, structuredClone(profile)] as const] : [])),
      getProfileForUser: async () => { if (options.profileFailure) throw new ProfileIdentityError(); return structuredClone(profile); },
    },
    "@/lib/auth": { requireAdmin: async () => {
      events.push("authorize"); if (options.denied) throw new Error("Denied");
      return { id: "1", role: "admin", emailVerified: true };
    } },
    "@/lib/prisma": { prisma: { user: {
      findMany: async (query: Query) => { calls.push({ method: "findMany", query }); return users.filter((row) => matches(row, query)); },
      findFirst: async (query: Query) => {
        calls.push({ method: "findFirst", query }); events.push("load");
        if (options.loadFailure) throw new Error("PRIVATE database details");
        return users.find((row) => matches(row, query)) ?? null;
      },
      findUnique: async (query: Query) => {
        calls.push({ method: "findUnique", query }); events.push("read-back");
        if (options.readBackFailure) throw new Error("PRIVATE read-back failure");
        return users.find((row) => matches(row, query)) ?? null;
      },
      updateMany: async (query: Query) => {
        calls.push({ method: "updateMany", query }); events.push("write");
        const row = users.find((candidate) => candidate.id === query.where?.id);
        if (row && options.concurrentImage) row.userImage = options.concurrentImage;
        if (row && options.concurrentRole) row.role = options.concurrentRole;
        if (options.writeFailure) {
          if (row && options.committedBeforeFailure) row.userImage = query.data!.userImage;
          throw new Error("PRIVATE connection failure");
        }
        const matching = users.filter((candidate) => matches(candidate, query));
        for (const candidate of matching) candidate.userImage = query.data!.userImage;
        return { count: matching.length };
      },
    } } },
    "@/lib/utils": { parseRecordId },
    "@/lib/cloudinary": {
      CloudinaryUploadError: SafeUploadError,
      uploadProfileImage: async (file: File, userId: string) => {
        events.push("upload"); uploads.push({ file, userId });
        if (options.safeUploadFailure) throw new SafeUploadError(options.safeUploadFailure);
        if (options.uploadFailure) throw new Error("PRIVATE provider secret");
        return uploaded;
      },
      deleteProfileImage: async (publicId: string, userId: string) => {
        events.push("cleanup"); deletes.push({ publicId, userId });
        if (options.cleanupFailure) throw new Error("PRIVATE cleanup failure");
      },
    },
    "next/cache": { revalidatePath: (path: string, type?: string) => revalidated.push({ path, type }) },
  };
  const database = (modules["@/lib/prisma"] as { prisma: Record<string, unknown> }).prisma;
  const profiles = {
    updateMany: async (query: Query) => {
      calls.push({ method: "profile.updateMany", query });
      if (!profile || options.profileWriteFailure || profile.userImage !== query.where?.userImage) return { count: 0 };
      profile.userImage = query.data!.userImage;
      return { count: 1 };
    },
  };
  Object.assign(database, { employee: profiles, student: profiles,
    $transaction: async (operation: (tx: Record<string, unknown>) => Promise<unknown>, settings: { isolationLevel: string }) => {
      assert.equal(settings.isolationLevel, "Serializable");
      const before = structuredClone(users), originalProfile = structuredClone(profile);
      try { return await operation(database); }
      catch (error) {
        if (!options.committedBeforeFailure && !options.concurrentImage && !options.concurrentRole) {
          users.splice(0, users.length, ...before); profile = originalProfile;
        }
        throw error;
      }
    },
  });
  const profileImageModule = { exports: {} };
  runInNewContext(profileImageCode, { module: profileImageModule, exports: profileImageModule.exports, File,
    require: (name: string) => { assert.ok(name in modules, "Unexpected profile image dependency: " + name); return modules[name]; },
  });
  modules["./profile-image"] = { ...profileImageModule.exports, ...modules["./profile-image"] as Record<string, unknown> };
  const loaded = { exports: {} };
  runInNewContext(code, { module: loaded, exports: loaded.exports, File,
    require: (name: string) => { assert.ok(name in modules, "Unexpected user service dependency: " + name); return modules[name]; },
  });
  return { service: loaded.exports as typeof userService, users, calls, events, uploads, deletes, revalidated, get profile() { return profile; } };
}

test("user management authorizes every read and upload before touching records or Cloudinary", async () => {
  const h = harness({ denied: true });
  await assert.rejects(h.service.getUsers(), /Denied/);
  await assert.rejects(h.service.getUserForEdit(id.toString()), /Denied/);
  await assert.rejects(h.service.updateUserImage(initial, form()), /Denied/);
  assert.deepEqual(h.events, ["authorize", "authorize", "authorize"]);
  assert.equal(h.calls.length, 0);
  assert.equal(h.uploads.length, 0);
});

test("user lists exclude the protected account in the query and serialize only public account metadata", async () => {
  const h = harness({ users: [user(), user({ id: 1n, role: "superAdmin", email: "PRIVATE-owner@example.test" })] });
  const result = await h.service.getUsers();
  assert.equal(result.length, 1);
  assert.equal(result[0].id, id.toString());
  assert.equal(result[0].createdAt, "2026-10-01T00:00:00.000Z");
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|passwordHash|sessionVersion|"key"/);
  assert.deepEqual(structuredClone(h.calls[0].query.where), { role: { not: "superAdmin" } });
  assert.deepEqual(Object.keys(h.calls[0].query.select!).sort(), ["createdAt", "email", "emailVerified", "id", "role", "updatedAt", "userImage"]);
});

test("edit lookups preserve BigInt precision and cannot reveal a hidden account", async () => {
  const h = harness({ users: [user(), user({ id: 1n, role: "superAdmin" })] });
  assert.equal((await h.service.getUserForEdit(id.toString()))?.id, id.toString());
  assert.equal(h.calls[0].query.where?.id, id);
  assert.equal(await h.service.getUserForEdit("1"), null);
  assert.equal(h.calls[1].query.where?.role?.not, "superAdmin");
  for (const value of ["", "0", "-1", "1.0", "01", " 1 ", "9223372036854775808"]) {
    const before = h.calls.length;
    assert.equal(await h.service.getUserForEdit(value), null, value);
    assert.equal(h.calls.length, before, value);
  }
});

test("photo saves reject ambiguous IDs, image fields, and removal choices before queries", async () => {
  const invalidForms: FormData[] = [];
  for (const invalid of ["", "0", "-1", "01", "1.2", "9223372036854775808"]) invalidForms.push(form({ userId: invalid }));
  const duplicateId = form(); duplicateId.append("userId", "1"); invalidForms.push(duplicateId);
  const fileId = form(); fileId.set("userId", new File(["1"], "id.txt")); invalidForms.push(fileId);
  const duplicateImage = form(); duplicateImage.append("image", new File(["other"], "other.png")); invalidForms.push(duplicateImage);
  invalidForms.push(form({ image: "https://untrusted.example.test/photo.png" }));
  invalidForms.push(form({ removeImage: "false" }));
  invalidForms.push(form({ removeImage: "true" }));
  const duplicateRemoval = form(); duplicateRemoval.delete("image"); duplicateRemoval.append("removeImage", "true"); duplicateRemoval.append("removeImage", "true"); invalidForms.push(duplicateRemoval);
  for (const input of invalidForms) {
    const h = harness();
    assert.equal((await h.service.updateUserImage(initial, input)).success, false);
    assert.equal(h.calls.length, 0);
    assert.equal(h.uploads.length, 0);
  }
});

test("saving without an optional photo preserves existing photos and makes no provider or database writes", async () => {
  for (const userImage of [user().userImage, null]) {
    for (const empty of [undefined, ...["", "undefined", "blob", "named-empty.png"].map((name) => new File([], name, { type: "application/octet-stream" }))]) {
      const h = harness({ users: [user({ userImage })], profile: { kind: "student", id: 100n, name: "Maria Santos", userImage } });
      const before = structuredClone(h.users);
      const input = form(); input.delete("image"); if (empty) input.set("image", empty);
      const result = await h.service.updateUserImage(initial, input);
      assert.deepEqual(structuredClone(result), { success: true, message: "User details saved." });
      assert.deepEqual(h.events, ["authorize", "load"]);
      assert.equal(h.calls.length, 1);
      assert.equal(h.calls[0].query.where?.id, id);
      assert.equal(h.calls[0].query.where?.role?.not, "superAdmin");
      assert.deepEqual(h.users, before);
      assert.equal(h.profile?.userImage, userImage);
      assert.equal(h.uploads.length, 0);
      assert.equal(h.deletes.length, 0);
      assert.equal(h.revalidated.length, 0);
    }
  }
});

test("saving without a photo still requires authorization and an existing visible account", async () => {
  const input = form(); input.delete("image");
  const denied = harness({ denied: true });
  await assert.rejects(denied.service.updateUserImage(initial, input), /Denied/);
  assert.equal(denied.calls.length, 0);
  for (const users of [[], [user({ role: "superAdmin" })]]) {
    const h = harness({ users });
    const result = await h.service.updateUserImage(initial, input);
    assert.equal(result.success, false);
    assert.doesNotMatch(result.message, /superAdmin|protected/i);
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].query.where?.role?.not, "superAdmin");
    assert.equal(h.uploads.length, 0);
  }
  for (const userId of ["", "0", "-1", "01", "1.2", "9223372036854775808"]) {
    const h = harness();
    input.set("userId", userId);
    assert.equal((await h.service.updateUserImage(initial, input)).success, false);
    assert.equal(h.calls.length, 0);
  }
});

test("missing and protected target accounts never trigger a Cloudinary upload", async () => {
  for (const users of [[], [user({ role: "superAdmin" })]]) {
    const h = harness({ users });
    const result = await h.service.updateUserImage(initial, form());
    assert.equal(result.success, false);
    assert.doesNotMatch(result.message, /superAdmin|protected/i);
    assert.equal(h.uploads.length, 0);
    assert.equal(h.calls[0].query.where?.role?.not, "superAdmin");
  }
});

test("successful uploads save only the provider URL and refresh portal avatars without changing account credentials", async () => {
  const h = harness();
  const result = await h.service.updateUserImage(initial, form({ email: "attacker@example.test", role: "superAdmin", passwordHash: "forged", userImage: "https://forged.example.test" }));
  assert.equal(result.success, true);
  assert.deepEqual(h.events, ["authorize", "load", "upload", "load", "write"]);
  assert.equal(h.uploads[0].userId, id.toString());
  assert.equal(h.users[0].userImage, uploaded.secureUrl);
  assert.equal(h.users[0].email, user().email);
  assert.equal(h.users[0].role, "teacher");
  assert.equal(h.users[0].passwordHash, "PRIVATE-PASSWORD");
  assert.equal(h.users[0].sessionVersion, 8);
  assert.deepEqual(Object.keys(h.calls.at(-1)!.query.data!), ["userImage"]);
  assert.deepEqual(h.revalidated, [{ path: "/portal", type: "layout" }]);
  assert.equal(h.deletes.length, 0);
});

test("explicit removal clears only the saved photo and accepts an empty browser file field", async () => {
  for (const name of ["", "undefined", "blob"]) {
    const h = harness();
    const input = form({ removeImage: "true", image: new File([], name, { type: "application/octet-stream" }) });
    assert.equal((await h.service.updateUserImage(initial, input)).success, true);
    assert.equal(h.users[0].userImage, null);
    assert.equal(h.uploads.length, 0);
    assert.equal(h.deletes.length, 0);
    const empty = harness({ users: [user({ userImage: null })] });
    assert.equal((await empty.service.updateUserImage(initial, input)).success, false);
    assert.equal(empty.calls.length, 1);
  }
});

test("failed upload or initial lookup leaves the original photo intact and hides private errors", async () => {
  for (const options of [{ uploadFailure: true }, { loadFailure: true }]) {
    const h = harness(options);
    const result = await h.service.updateUserImage(initial, form());
    assert.equal(result.success, false);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE|secret|database details/);
    assert.equal(h.users[0].userImage, user().userImage);
    assert.equal(h.calls.some((call) => call.method === "updateMany"), false);
    assert.equal(h.revalidated.length, 0);
  }
});

test("safe image validation and configuration errors remain actionable beside the file field", async () => {
  for (const message of ["The profile image must be 5 MB or smaller.", "Profile image uploads are not configured. Contact your administrator."]) {
    const h = harness({ safeUploadFailure: message });
    const result = await h.service.updateUserImage(initial, form());
    assert.equal(result.success, false);
    assert.equal(result.fieldErrors?.image, message);
    assert.equal(result.message, message);
    assert.equal(h.calls.some((call) => call.method === "updateMany"), false);
  }
});

test("concurrent photo changes and role changes cannot be overwritten and discard only the new upload", async () => {
  for (const options of [{ concurrentImage: "https://newer.example.test/photo.png" }, { concurrentRole: "superAdmin" as const }]) {
    const h = harness(options);
    const result = await h.service.updateUserImage(initial, form());
    assert.equal(result.success, false);
    assert.match(result.message, /changed/);
    assert.equal(h.users[0].userImage, options.concurrentImage ?? user().userImage);
    assert.deepEqual(h.deletes, [{ publicId: uploaded.publicId, userId: id.toString() }]);
    assert.equal(h.revalidated.length, 0);
    const write = h.calls.find((call) => call.method === "updateMany")!;
    assert.equal(write.query.where?.role?.not, "superAdmin");
    assert.equal(write.query.where?.userImage, user().userImage);
  }
});

test("database write failures clean an unused upload while cleanup errors preserve the safe save failure", async () => {
  for (const cleanupFailure of [false, true]) {
    const h = harness({ writeFailure: true, cleanupFailure });
    const result = await h.service.updateUserImage(initial, form());
    assert.equal(result.success, false);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE/);
    assert.deepEqual(h.events, ["authorize", "load", "upload", "load", "write", "read-back", "cleanup"]);
    assert.equal(h.users[0].userImage, user().userImage);
    assert.equal(h.deletes.length, 1);
  }
});

test("uncertain database outcomes never delete a photo that may have committed", async () => {
  for (const options of [{ committedBeforeFailure: true }, { readBackFailure: true }]) {
    const h = harness({ writeFailure: true, ...options });
    const result = await h.service.updateUserImage(initial, form());
    assert.equal(result.success, false);
    assert.equal(h.deletes.length, 0);
    assert.equal(h.revalidated.length, 0);
    if (options.committedBeforeFailure) assert.equal(h.users[0].userImage, uploaded.secureUrl);
  }
});

test("Manage Users returns the saved name and photo from the linked profile and updates both records atomically", async () => {
  for (const kind of ["employee", "student"] as const) {
    const h = harness({ profile: { kind, id: 100n, name: "Maria Reyes Santos", userImage: null } });
    assert.equal((await h.service.getUsers())[0].name, "Maria Reyes Santos");
    assert.equal((await h.service.getUserForEdit(id.toString()))?.name, "Maria Reyes Santos");
    assert.equal((await h.service.updateUserImage(initial, form())).success, true);
    assert.equal(h.users[0].userImage, uploaded.secureUrl); assert.equal(h.profile?.userImage, uploaded.secureUrl);
    const removal = form({ removeImage: "true" }); removal.delete("image");
    assert.equal((await h.service.updateUserImage(initial, removal)).success, true);
    assert.equal(h.users[0].userImage, null); assert.equal(h.profile?.userImage, null);
  }
});

test("conflicting profile identities block uploads and a failed profile write rolls back the account photo", async () => {
  const conflicted = harness({ profileFailure: true });
  assert.equal((await conflicted.service.updateUserImage(initial, form())).success, false);
  assert.equal(conflicted.uploads.length, 0);
  const h = harness({ profile: { kind: "student", id: 100n, name: "Maria Santos", userImage: null }, profileWriteFailure: true });
  assert.equal((await h.service.updateUserImage(initial, form())).success, false);
  assert.equal(h.users[0].userImage, user().userImage); assert.equal(h.profile?.userImage, null);
  assert.equal(h.deletes.length, 1);
});
