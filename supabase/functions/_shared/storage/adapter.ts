import type { SupabaseClient } from "@supabase/supabase-js";

export interface ProductStorage {
  upload(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  remove(path: string): Promise<void>;
  publicUrl(path: string): string;
}

export function productStorage(client: SupabaseClient): ProductStorage {
  const bucket = client.storage.from("product-images");
  return {
    async upload(path, bytes, contentType) {
      const { error } = await bucket.upload(path, bytes, {
        contentType,
        upsert: false,
      });
      if (error) throw new Error("Storage upload failed");
    },
    async remove(path) {
      const { error } = await bucket.remove([path]);
      if (error) throw new Error("Storage removal failed");
    },
    publicUrl: (path) => bucket.getPublicUrl(path).data.publicUrl,
  };
}
