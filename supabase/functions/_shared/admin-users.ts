import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShopService } from "./service.ts";
import type { AdminRole } from "./admin-access.ts";
import { AppError } from "./domain.ts";
import { generatePassword } from "./password-policy.ts";

export class AdminUsers {
  constructor(
    private db: ShopService["db"],
    private auth: SupabaseClient
  ) {}

  async list(page: number) {
    const rows = await this.db.adminProfile.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: (page - 1) * 25,
      take: 26,
    });
    const users = await Promise.all(
      rows.slice(0, 25).map(async (profile) => {
        const { data, error } = await this.auth.auth.admin.getUserById(
          profile.id
        );
        if (error || !data.user)
          throw new AppError(
            503,
            "No se pudieron consultar los correos. Intenta de nuevo."
          );
        return {
          id: profile.id,
          role: profile.role,
          active: profile.active,
          email: data.user.email || "",
        };
      })
    );
    return { users, page, hasMore: rows.length > 25 };
  }

  private async reserveDelivery(id: string) {
    const key = "admin-password-link:" + id;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60_000);
    const updated = await this.db.rateLimit.updateMany({
      where: { key, expiresAt: { lte: now } },
      data: { expiresAt },
    });
    if (updated.count) return;
    try {
      await this.db.rateLimit.create({ data: { key, expiresAt } });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002")
        throw new AppError(
          429,
          "Espera 60 segundos antes de enviar otro enlace."
        );
      throw error;
    }
  }

  async sendLink(id: string) {
    const profile = await this.db.adminProfile.findUnique({ where: { id } });
    if (!profile?.active)
      throw new AppError(400, "El usuario debe tener un perfil activo.");
    const { data, error } = await this.auth.auth.admin.getUserById(id);
    if (error || !data.user?.email)
      throw new AppError(503, "No se pudo consultar la cuenta.");
    await this.reserveDelivery(id);
    // Supabase's configured template and SiteURL own the destination, never request input.
    try {
      const result = await this.auth.auth.resetPasswordForEmail(
        data.user.email
      );
      if (result.error) throw result.error;
    } catch {
      throw new AppError(
        503,
        "No se pudo enviar el enlace. Espera un minuto y vuelve a intentarlo."
      );
    }
    return {
      message:
        "Solicitud de correo aceptada. Pide al usuario revisar su bandeja y spam.",
    };
  }

  async create(email: string, role: AdminRole) {
    const { data, error } = await this.auth.auth.admin.createUser({
      email,
      password: generatePassword(),
      email_confirm: true,
    });
    if (error || !data.user) {
      if (
        error &&
        ["email_exists", "user_already_exists"].includes(error.code || "")
      )
        throw new AppError(
          409,
          "Ya existe una cuenta con ese correo. No se modificaron sus permisos ni contraseña."
        );
      throw new AppError(503, "No se pudo crear la cuenta. Intenta de nuevo.");
    }
    const id = data.user.id;
    try {
      await this.db.adminProfile.create({ data: { id, role, active: true } });
    } catch {
      try {
        const removed = await this.auth.auth.admin.deleteUser(id);
        if (removed.error) throw removed.error;
      } catch {
        console.error("admin_user_cleanup_required", { userId: id });
      }
      throw new AppError(
        503,
        "No se pudo guardar el perfil. Si el correo aparece ocupado al reintentar, contacta al responsable del sistema."
      );
    }
    try {
      const delivery = await this.sendLink(id);
      return {
        id,
        email,
        role,
        active: true,
        emailStatus: "accepted",
        message: "Usuario creado. " + delivery.message,
      };
    } catch {
      return {
        id,
        email,
        role,
        active: true,
        emailStatus: "failed",
        message:
          "Usuario creado; no se pudo enviar el enlace. Puedes reenviarlo desde Usuarios en un minuto.",
      };
    }
  }
}
