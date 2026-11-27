export type RestockEmailInput = {
  productName: string;
  size: string;
  color: string;
  productUrl: string;
  unsubscribeUrl: string;
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

/** Back-in-stock email (HTML + plain text), no template engine needed. */
export function renderRestockEmail(input: RestockEmailInput) {
  const variant = `${input.size} / ${input.color}`;
  const name = escapeHtml(input.productName);
  const productUrl = escapeHtml(input.productUrl);
  const unsubscribeUrl = escapeHtml(input.unsubscribeUrl);
  const subject = `Volvió ${input.productName}`;
  const text = [
    `${input.productName} (${variant}) volvió a estar disponible.`,
    "",
    `Ver producto: ${input.productUrl}`,
    "",
    "Las piezas son limitadas y no las apartamos por este aviso.",
    `Cancelar avisos: ${input.unsubscribeUrl}`,
  ].join("\n");
  const html = `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:#f6f4ef;color:#111;font-family:Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f4ef">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e5e1d8">
<tr><td style="padding:24px 28px;border-bottom:1px solid #e5e1d8;font-size:13px;letter-spacing:.2em;text-transform:uppercase">Lowkey Saints</td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 8px;font-size:13px;color:#6b6457">Aviso de disponibilidad</p>
<h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;font-weight:600">${name} volvió</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.5">La talla y color que pediste (<strong>${escapeHtml(variant)}</strong>) ya tiene piezas disponibles.</p>
<a href="${productUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:14px 24px;font-size:14px;font-weight:600">Ver producto</a>
<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#6b6457">Las piezas son limitadas y no las apartamos por este aviso.</p>
</td></tr>
<tr><td style="padding:20px 28px;border-top:1px solid #e5e1d8;font-size:12px;line-height:1.5;color:#6b6457">Recibiste este correo porque pediste un aviso de reposición. <a href="${unsubscribeUrl}" style="color:#6b6457">Cancelar avisos</a></td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  return { subject, html, text };
}
