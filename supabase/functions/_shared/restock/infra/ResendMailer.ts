/** Minimal Resend adapter over fetch: no SDK in the Deno bundle, injectable in tests. */
export class ProviderError extends Error {
  constructor(
    readonly status: number | null,
    message: string
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export type MailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
  idempotencyKey: string;
};

export type Mailer = { send(message: MailMessage): Promise<void> };

export function createResendMailer(
  config: { apiKey: string; from: string },
  send: typeof fetch = fetch
): Mailer {
  return {
    async send(message) {
      let res: Response;
      try {
        res = await send("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + config.apiKey,
            "Content-Type": "application/json",
            "Idempotency-Key": message.idempotencyKey,
          },
          body: JSON.stringify({
            from: config.from,
            to: [message.to],
            subject: message.subject,
            html: message.html,
            text: message.text,
            headers: message.headers,
          }),
          signal: AbortSignal.timeout(15000),
        });
      } catch (e) {
        throw new ProviderError(
          null,
          e instanceof Error ? e.message.slice(0, 200) : "Error de red"
        );
      }
      // Release the connection; the body is not needed.
      await res.body?.cancel().catch(() => {});
      if (!res.ok)
        throw new ProviderError(
          res.status,
          "Proveedor respondió HTTP " + res.status
        );
    },
  };
}
