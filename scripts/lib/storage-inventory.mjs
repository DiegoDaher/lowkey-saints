// Traverse folders and every page before allowing callers to apply an inventory.
export async function listStorageObjects(
  bucket,
  prefix = "",
  seen = new Set()
) {
  const objects = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await bucket.list(prefix, {
      limit: 100,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error || !data)
      throw new Error("Storage inventory failed; no candidates registered");
    for (const entry of data) {
      const path = prefix ? prefix + "/" + entry.name : entry.name;
      if (seen.has(path))
        throw new Error(
          "Storage changed during inventory; retry with writes paused"
        );
      seen.add(path);
      if (entry.id) objects.push(path);
      else objects.push(...(await listStorageObjects(bucket, path, seen)));
    }
    if (data.length < 100) return objects;
  }
}
