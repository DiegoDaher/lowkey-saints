import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../supabase/functions/_shared/domain.ts";
import {
  readLimitedBody,
  readJsonBody,
  JSON_BODY_LIMIT,
  IMAGE_BODY_LIMIT,
} from "../supabase/functions/_shared/request-body.ts";

function streamed(chunks: Uint8Array[], length?: string) {
  let reads = 0;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (reads < chunks.length) controller.enqueue(chunks[reads++]);
        else controller.close();
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 }
  );
  const request = new Request("http://localhost/test", {
    method: "POST",
    body: stream,
    headers: length === undefined ? {} : { "content-length": length },
    duplex: "half",
  } as RequestInit);
  return { request, reads: () => reads, cancelled: () => cancelled };
}
const status = (code: number) => (error: unknown) =>
  error instanceof AppError && error.status === code;

for (const limit of [JSON_BODY_LIMIT, IMAGE_BODY_LIMIT]) {
  for (const size of [0, limit - 1, limit]) {
    test(`accepts ${size} bytes with limit ${limit}`, async () => {
      const input = streamed([new Uint8Array(size)]);
      assert.equal(
        (await readLimitedBody(input.request, limit)).byteLength,
        size
      );
    });
  }
  for (const length of [undefined, "1", "invalid", "-1", "1.5"]) {
    test(`cancels overflow at ${limit} bytes with Content-Length ${length}`, async () => {
      const input = streamed(
        [new Uint8Array(limit), new Uint8Array(1), new Uint8Array(10)],
        length
      );
      await assert.rejects(readLimitedBody(input.request, limit), status(413));
      assert.equal(input.reads(), 2);
      assert.equal(input.cancelled(), true);
    });
  }
  test(`rejects declared overflow before reading with limit ${limit}`, async () => {
    const input = streamed([new Uint8Array(1)], String(limit + 1));
    await assert.rejects(readLimitedBody(input.request, limit), status(413));
    assert.equal(input.reads(), 0);
    assert.equal(input.cancelled(), true);
  });
}
test("counts UTF-8 bytes rather than JavaScript characters", async () => {
  const raw = JSON.stringify("é".repeat(100_000));
  assert.ok(raw.length < JSON_BODY_LIMIT);
  const input = streamed([new TextEncoder().encode(raw)]);
  await assert.rejects(readJsonBody(input.request), status(413));
});
test("preserves UTF-8 split across chunks and exact JSON limit", async () => {
  const raw = JSON.stringify("é".repeat(99_999));
  const bytes = new TextEncoder().encode(raw);
  assert.equal(bytes.length, JSON_BODY_LIMIT);
  const input = streamed(
    [bytes.slice(0, 2), bytes.slice(2)],
    String(bytes.length)
  );
  assert.equal(await readJsonBody(input.request), JSON.parse(raw));
});
test("invalid JSON remains 400", async () => {
  await assert.rejects(
    readJsonBody(streamed([new TextEncoder().encode("{")]).request),
    status(400)
  );
});
test("empty body returns bytes and invalid JSON remains 400", async () => {
  assert.equal(
    (await readLimitedBody(new Request("http://localhost"), 10)).length,
    0
  );
  await assert.rejects(
    readJsonBody(new Request("http://localhost")),
    status(400)
  );
});
test("preserves binary image bytes", async () => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 255]);
  assert.deepEqual(
    await readLimitedBody(
      streamed([png.slice(0, 4), png.slice(4)]).request,
      IMAGE_BODY_LIMIT
    ),
    png
  );
});
test("stream failure is not mislabeled as malformed JSON", async () => {
  const failure = new Error("transport failure");
  const req = new Request("http://localhost", {
    method: "POST",
    body: new ReadableStream({
      start(c) {
        c.error(failure);
      },
    }),
    duplex: "half",
  } as RequestInit);
  await assert.rejects(readJsonBody(req), (error) => error === failure);
});
