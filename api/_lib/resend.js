const RESEND_API_URL = "https://api.resend.com/emails";
const CLUB_URL = "https://www.buenosaireswax.com/club";
const CONTACT_EMAIL = "buenosaireswax@gmail.com";
const INSTAGRAM_URL = "https://www.instagram.com/buenosaireswax/";

function escapeHtml(valor) {
  return String(valor || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function nombrePila(nombre) {
  const limpio = String(nombre || "").trim();
  if (!limpio) return "";
  return limpio.split(/\s+/)[0];
}

function construirHtml({ nombre }) {
  const saludo = nombrePila(nombre);
  const titulo = saludo ? `Bienvenido, ${escapeHtml(saludo)}` : "Bienvenido al Club";

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Bienvenido al Club de Vinilos de BAWAX</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f4f2;font-family:Helvetica,Arial,sans-serif;color:#111111;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f2;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:#111111;padding:36px 32px;text-align:center;">
                <div style="font-size:30px;line-height:1;letter-spacing:10px;color:#ffffff;font-weight:700;">BAWAX</div>
                <div style="margin-top:12px;font-size:11px;letter-spacing:4px;color:#bdbdbd;text-transform:uppercase;">Club de Vinilos</div>
              </td>
            </tr>
            <tr>
              <td style="padding:40px 32px 24px;">
                <h1 style="margin:0 0 16px;font-size:26px;line-height:1.25;color:#111111;">${titulo}</h1>
                <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#333333;">
                  Tu suscripción al Club de Vinilos de BAWAX está activa. A partir de ahora vas a recibir cada mes una selección de vinilos curada por nosotros, pensada para tu colección.
                </p>
                <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#333333;">
                  Esto es lo que te espera:
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                  <tr>
                    <td style="padding:12px 0;border-bottom:1px solid #eeeeee;font-size:15px;line-height:1.5;color:#333333;">
                      <strong style="color:#111111;">Vinilo curado</strong><br />
                      Deep house, house y techno elegidos especialmente para cada miembro.
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 0;border-bottom:1px solid #eeeeee;font-size:15px;line-height:1.5;color:#333333;">
                      <strong style="color:#111111;">Regalos especiales</strong><br />
                      Slipmats, kits de limpieza y accesorios personalizados.
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 0;font-size:15px;line-height:1.5;color:#333333;">
                      <strong style="color:#111111;">Accesos exclusivos</strong><br />
                      Entradas y beneficios en los eventos de BAWAX.
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 28px;font-size:16px;line-height:1.6;color:#333333;">
                  Nos ponemos en contacto con los próximos pasos para preparar tu primera caja. Si tenés alguna duda, respondé este correo o escribinos a
                  <a href="mailto:${CONTACT_EMAIL}" style="color:#111111;font-weight:700;">${CONTACT_EMAIL}</a>.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                  <tr>
                    <td style="border-radius:999px;background:#111111;">
                      <a href="${CLUB_URL}" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:700;letter-spacing:1px;color:#ffffff;text-decoration:none;text-transform:uppercase;">
                        Visitar el club
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 32px;text-align:center;">
                <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#777777;">
                  Seguinos en <a href="${INSTAGRAM_URL}" style="color:#111111;text-decoration:underline;">Instagram</a> para ver los drops y novedades.
                </p>
              </td>
            </tr>
            <tr>
              <td style="background:#111111;padding:20px 32px;text-align:center;">
                <p style="margin:0;font-size:11px;line-height:1.5;color:#9a9a9a;">
                  Recibís este correo porque te suscribiste al Club de Vinilos de BAWAX.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function construirTexto({ nombre }) {
  const saludo = nombrePila(nombre);
  const titulo = saludo ? `Bienvenido, ${saludo}` : "Bienvenido al Club";

  return `${titulo}

Tu suscripción al Club de Vinilos de BAWAX está activa. A partir de ahora vas a recibir cada mes una selección de vinilos curada por nosotros.

Esto es lo que te espera:
- Vinilo curado: deep house, house y techno elegidos especialmente para cada miembro.
- Regalos especiales: slipmats, kits de limpieza y accesorios personalizados.
- Accesos exclusivos: entradas y beneficios en los eventos de BAWAX.

Nos ponemos en contacto con los próximos pasos para preparar tu primera caja.
Si tenés alguna duda, respondé este correo o escribinos a ${CONTACT_EMAIL}.

Visitanos: ${CLUB_URL}
Instagram: ${INSTAGRAM_URL}

Recibís este correo porque te suscribiste al Club de Vinilos de BAWAX.`;
}

export function resendConfigurado() {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function enviarEmailBienvenida({ to, nombre, idempotencyKey }) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY no configurada");
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const fromName = process.env.RESEND_FROM_NAME || "BAWAX Club de Vinilos";
  const replyTo = process.env.RESEND_REPLY_TO || CONTACT_EMAIL;
  const asunto =
    process.env.RESEND_WELCOME_SUBJECT ||
    "Bienvenido al Club de Vinilos de BAWAX";

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  if (idempotencyKey) {
    headers["Idempotency-Key"] = String(idempotencyKey).slice(0, 256);
  }

  const respuesta = await fetch(RESEND_API_URL, {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(8000),
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      reply_to: replyTo,
      subject: asunto,
      html: construirHtml({ nombre }),
      text: construirTexto({ nombre }),
    }),
  });

  const data = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    const mensaje =
      data?.message || data?.error || `Resend respondió ${respuesta.status}`;
    throw new Error(mensaje);
  }

  return data;
}
