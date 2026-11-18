import AuthForm from "@/components/admin/AuthForm";
import Link from "next/link";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ actualizada?: string; enlace?: string }>;
}) {
  const params = await searchParams;
  return (
    <>
      {params.actualizada && (
        <p role="status" className="p-4 text-center">
          Contraseña actualizada. Inicia sesión.
        </p>
      )}
      {params.enlace && (
        <p role="alert" className="p-4 text-center">
          El enlace no es válido o expiró.{" "}
          <Link href="/admin/recuperar">Solicita otro enlace.</Link>
        </p>
      )}
      <AuthForm mode="login" />
    </>
  );
}
