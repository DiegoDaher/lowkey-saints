import { test } from "node:test";
import assert from "node:assert/strict";
import { AdminUsers } from "../supabase/functions/_shared/admin-users.ts";
import {
  generatePassword,
  validNewPassword,
} from "../supabase/functions/_shared/password-policy.ts";

function fixture() {
  const calls: string[] = [];
  let authExists = false;
  let profile: { id: string; active: boolean; role: string } | null = null;
  let deliveryReserved = false;
  const failure = { profile: false, mail: false, auth: false, cleanup: false };
  const auth = {
    auth: {
      admin: {
        async createUser(input: { password: string }) {
          calls.push("create");
          assert.equal(input.password.length, 24);
          if (authExists) return { data: {}, error: { code: "email_exists" } };
          if (failure.auth)
            return { data: {}, error: { code: "unexpected_failure" } };
          authExists = true;
          return { data: { user: { id: "new-user" } }, error: null };
        },
        async getUserById() {
          return { data: { user: { email: "new@example.test" } }, error: null };
        },
        async deleteUser() {
          calls.push("delete");
          if (failure.cleanup) return { error: new Error("failed") };
          authExists = false;
          return { error: null };
        },
      },
      async resetPasswordForEmail() {
        calls.push("mail");
        assert.ok(profile, "profile must be saved before email");
        return { error: failure.mail ? new Error("mail failed") : null };
      },
    },
  };
  const db = {
    adminProfile: {
      async create({ data }: { data: NonNullable<typeof profile> }) {
        calls.push("profile");
        if (failure.profile) throw new Error("database failed");
        profile = data;
        return profile;
      },
      async findUnique() {
        return profile;
      },
      async findMany() {
        return profile ? [profile] : [];
      },
    },
    rateLimit: {
      async updateMany() {
        return { count: 0 };
      },
      async create() {
        if (deliveryReserved) throw { code: "P2002" };
        deliveryReserved = true;
      },
    },
  };
  const service = new AdminUsers(
    db as unknown as ConstructorParameters<typeof AdminUsers>[0],
    auth as unknown as ConstructorParameters<typeof AdminUsers>[1]
  );
  return {
    service,
    calls,
    failure,
    expire: () => {
      deliveryReserved = false;
    },
    deactivate: () => {
      if (profile) profile.active = false;
    },
  };
}

test("password generation and shared length policy", () => {
  const passwords = new Set(Array.from({ length: 100 }, generatePassword));
  assert.equal(passwords.size, 100);
  for (const password of passwords) {
    assert.equal(password.length, 24);
    for (const expression of [/[a-z]/, /[A-Z]/, /\d/, /[^\w]/])
      assert.match(password, expression);
  }
  assert.equal(validNewPassword("a".repeat(11)), false);
  assert.equal(validNewPassword("a".repeat(12)), true);
  assert.equal(validNewPassword("a".repeat(128)), true);
  assert.equal(validNewPassword("a".repeat(129)), false);
});

for (const role of ["ADMIN", "OPERATOR"] as const) {
  test(`creates ${role}, persists before mailing and never returns password`, async () => {
    const f = fixture();
    const result = await f.service.create("new@example.test", role);
    assert.equal(result.role, role);
    assert.equal(result.emailStatus, "accepted");
    assert.equal("password" in result, false);
    assert.deepEqual(f.calls, ["create", "profile", "mail"]);
    const list = await f.service.list(1);
    assert.equal(list.users[0].email, "new@example.test");
    assert.equal(list.hasMore, false);
    await assert.rejects(f.service.create("new@example.test", role), {
      status: 409,
    });
    assert.equal(f.calls.filter((c) => c === "profile").length, 1);
  });
}

test("rolls back only newly created Auth account on profile failure", async () => {
  const f = fixture();
  f.failure.profile = true;
  await assert.rejects(f.service.create("new@example.test", "ADMIN"), {
    status: 503,
  });
  assert.deepEqual(f.calls, ["create", "profile", "delete"]);
  f.failure.profile = false;
  assert.equal(
    (await f.service.create("new@example.test", "ADMIN")).emailStatus,
    "accepted"
  );
});

test("Auth failure never creates a profile or sends a message", async () => {
  const f = fixture();
  f.failure.auth = true;
  await assert.rejects(f.service.create("new@example.test", "ADMIN"), {
    status: 503,
  });
  assert.deepEqual(f.calls, ["create"]);
});

test("mail failure preserves account; cooldown and resend do not duplicate it", async () => {
  const f = fixture();
  f.failure.mail = true;
  const result = await f.service.create("new@example.test", "OPERATOR");
  assert.equal(result.emailStatus, "failed");
  await assert.rejects(f.service.sendLink(result.id), { status: 429 });
  f.failure.mail = false;
  f.expire();
  await f.service.sendLink(result.id);
  assert.equal(f.calls.filter((c) => c === "create").length, 1);
  assert.equal(f.calls.filter((c) => c === "mail").length, 2);
  f.deactivate();
  await assert.rejects(f.service.sendLink(result.id), { status: 400 });
});

test("concurrent sends share one delivery reservation", async () => {
  const f = fixture();
  await f.service.create("new@example.test", "OPERATOR");
  f.expire();
  const results = await Promise.allSettled([
    f.service.sendLink("new-user"),
    f.service.sendLink("new-user"),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(f.calls.filter((c) => c === "mail").length, 2);
});
