"use client";
import AdminButton from "@/components/admin/AdminButton";
export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto space-y-4 p-8">
      <h1>No se pudo verificar el acceso</h1>
      <p>El servicio no está disponible. Intenta de nuevo.</p>
      <AdminButton className="shop-button" onClick={reset}>
        Reintentar
      </AdminButton>
    </main>
  );
}
