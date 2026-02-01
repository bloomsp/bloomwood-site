export const onRequestPost: PagesFunction = async (context) => {
  const { request, env } = context;

  const API_TOKEN = env.MAILERSEND_API_TOKEN as string | undefined;
  const FROM_EMAIL = (env.MAIL_FROM as string | undefined) ?? "help@bloomwood.com.au";
  const TO_EMAIL = (env.MAIL_TO as string | undefined) ?? "help@bloomwood.com.au";

  if (!API_TOKEN) {
    return new Response("MailerSend is not configured.", { status: 500 });
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/x-www-form-urlencoded") && !contentType.includes("multipart/form-data")) {
    return new Response("Unsupported content type.", { status: 415 });
  }

  const form = await request.formData();

  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const message = String(form.get("message") ?? "").trim();
  const newsletter = form.get("newsletter") ? "Yes" : "No";

  // Honeypot field (should be left empty by humans)
  const company = String(form.get("company") ?? "").trim();
  if (company) {
    return new Response("OK", { status: 200 });
  }

  // Optional simple math check from the existing UI (13 + 12 = 25)
  const captcha = String(form.get("captcha") ?? "").trim();
  if (captcha && captcha !== "25") {
    return new Response("Captcha incorrect.", { status: 400 });
  }

  if (!name || !email || !message) {
    return new Response("Missing required fields.", { status: 400 });
  }

  const subject = `Website contact form: ${name}`;
  const text = [
    "New website contact form submission:",
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    `Newsletter: ${newsletter}`,
    "",
    "Message:",
    message,
  ].join("\n");

  const payload = {
    from: {
      email: FROM_EMAIL,
      name: "Bloomwood Solutions",
    },
    to: [{ email: TO_EMAIL }],
    reply_to: {
      email,
      name,
    },
    subject,
    text,
  };

  const resp = await fetch("https://api.mailersend.com/v1/email", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    return new Response(`MailerSend error: ${resp.status}\n${body}`, { status: 502 });
  }

  // Redirect back to the contact page with a success flag
  const url = new URL(request.url);
  return Response.redirect(`${url.origin}/solutions/bloomwood-solutions-contact-us/?sent=1`, 303);
};
