import ProductDetail from "@/components/shop/ProductDetail";
import { api } from "@/lib/api";
import type { CatalogProduct } from "../../../../supabase/functions/_shared/contracts";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let product: CatalogProduct | undefined;
  let error = "";
  try {
    product = await api<CatalogProduct>(
      "/products/" + encodeURIComponent(slug)
    );
  } catch (e) {
    error = (e as Error).message;
  }
  return product ? (
    <ProductDetail product={product} />
  ) : (
    <main className="p-12" role="alert">
      {error}
    </main>
  );
}
