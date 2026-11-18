"use server";

import { redirect } from "next/navigation";
import { supabaseServer, getAdminProfile } from "./supabase";

export type AuthState = { error?: string; message?: string };
const emailValue = (form: FormData) =>
  String(form.get("email") || "")
    .trim()
    .toLowerCase();
const validEmail = (value: string) =>
  value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export async function login(
  _state: AuthState,
  form: FormData
): Promise<AuthState> {
  const email = emailValue(form);
  const password = String(form.get("password") || "");
  if (!validEmail(email) || !password || password.length > 1024)
    return { error: "Revisa tu correo y contraseña." };
  try {
    const client = await supabaseServer();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error)
      return {
        error:
          "No se pudo iniciar sesión. Revisa tus credenciales e intenta de nuevo.",
      };
    try {
      await getAdminProfile();
    } catch {
      await client.auth.signOut();
      return {
        error:
          "No se pudo verificar tu acceso administrativo. Contacta al administrador o intenta de nuevo.",
      };
    }
  } catch {
    return { error: "El servicio no está disponible. Intenta de nuevo." };
  }
  redirect("/140210");
}

export async function logout() {
  const client = await supabaseServer();
  const { error } = await client.auth.signOut();
  if (error) throw new Error("No se pudo cerrar la sesión. Intenta de nuevo.");
  redirect("/140210/login");
}

export async function requestRecovery(
  _state: AuthState,
  form: FormData
): Promise<AuthState> {
  const email = emailValue(form);
  if (!validEmail(email)) return { error: "Escribe un correo válido." };
  try {
    const client = await supabaseServer();
    // The recovery email template uses SiteURL + /140210/auth/confirm and TokenHash.
    const { error } = await client.auth.resetPasswordForEmail(email);
    if (error && error.status && error.status >= 500)
      return { error: "El servicio no está disponible. Intenta de nuevo." };
  } catch {
    return { error: "El servicio no está disponible. Intenta de nuevo." };
  }
  return {
    message:
      "Si existe una cuenta con ese correo, recibirás instrucciones para restablecer tu contraseña. Revisa tu bandeja o intenta más tarde.",
  };
}

export async function resetPassword(
  _state: AuthState,
  form: FormData
): Promise<AuthState> {
  const password = String(form.get("password") || "");
  if (
    !password ||
    password.length > 1024 ||
    password !== form.get("confirmation")
  )
    return { error: "Las contraseñas deben coincidir y no estar vacías." };
  try {
    const client = await supabaseServer();
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    if (error || !user)
      return { error: "El enlace expiró. Solicita uno nuevo." };
    const { error: updateError } = await client.auth.updateUser({ password });
    if (updateError)
      return {
        error:
          "No se pudo actualizar. Usa una contraseña que cumpla la política de seguridad de tu cuenta o solicita un enlace nuevo.",
      };
    await client.auth.signOut();
  } catch {
    return { error: "El servicio no está disponible. Intenta de nuevo." };
  }
  redirect("/140210/login?actualizada=1");
}
