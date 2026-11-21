import AnnouncementBar from "@/components/AnnouncementBar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { CartProvider } from "@/components/shop/CartProvider";
import { CatalogFilterProvider } from "@/components/catalog/CatalogFilterProvider";
export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      <CatalogFilterProvider>
        <AnnouncementBar />
        <Header />
        {children}
        <Footer />
      </CatalogFilterProvider>
    </CartProvider>
  );
}
