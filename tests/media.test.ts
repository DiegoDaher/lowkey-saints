import { test } from "node:test";
import assert from "node:assert/strict";
import { imageExtension } from "../supabase/functions/_shared/storage/validation.ts";
import { listStorageObjects } from "../scripts/lib/storage-inventory.mjs";

test("image validation checks actual signature, MIME and exact byte limit", () => {
  const jpg = new Uint8Array(5 * 1024 * 1024);
  jpg.set([255, 216, 255]);
  assert.equal(imageExtension(jpg, "image/jpeg"), "jpg");
  assert.throws(
    () => imageExtension(new Uint8Array(jpg.length + 1), "image/jpeg"),
    { status: 413 }
  );
  assert.throws(() => imageExtension(jpg, "image/png"), { status: 400 });
  assert.throws(() => imageExtension(jpg, "image/svg+xml"), { status: 400 });
  assert.throws(() => imageExtension(new Uint8Array(), "image/webp"), {
    status: 400,
  });
  assert.equal(
    imageExtension(
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      "image/png"
    ),
    "png"
  );
  assert.equal(
    imageExtension(new TextEncoder().encode("RIFF0000WEBP"), "image/webp"),
    "webp"
  );
});

test("historical inventory visits every page and nested folder; failure aborts", async () => {
  const calls: string[] = [];
  const bucket = {
    async list(prefix: string, { offset }: { offset: number }) {
      calls.push(`${prefix}:${offset}`);
      if (prefix === "folder")
        return { data: [{ name: "nested.webp", id: "nested" }], error: null };
      return {
        data:
          offset === 0
            ? Array.from({ length: 100 }, (_, i) => ({
                name: `${i}.webp`,
                id: String(i),
              }))
            : [{ name: "folder", id: null }],
        error: null,
      };
    },
  };
  const paths = await listStorageObjects(bucket);
  assert.equal(paths.length, 101);
  assert.ok(paths.includes("folder/nested.webp"));
  assert.deepEqual(calls, [":0", ":100", "folder:0"]);
  await assert.rejects(
    listStorageObjects({
      list: async () => ({ error: new Error("unavailable") }),
    })
  );
});
