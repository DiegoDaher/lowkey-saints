"use client";
import AdminButton from "@/components/admin/AdminButton";
export default function AdminError({ retry }: { retry: () => void }) {
  return (
    <main className="mx-auto space-y-4 p-8">
      <h1>No se pudo cargar la administración</h1>
      <p>Ocurrió un error al cargar esta página. Intenta de nuevo.</p>
      <AdminButton className="shop-button" onClick={retry}>
        Reintentar
      </AdminButton>
    </main>
  );
}
