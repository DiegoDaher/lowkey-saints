import { logout } from "@/server/auth/actions";
export default function NoAccessPage() {
  return (
    <main className="space-y-4 p-8">
      <h1>Sin acceso administrativo</h1>
      <p>Contacta al administrador para revisar los permisos de tu cuenta.</p>
      <form action={logout}>
        <button className="shop-button">Cerrar sesión</button>
      </form>
    </main>
  );
}
