// Thin wrapper so the rest of the app doesn't care which provider sends mail.
// If RESEND_API_KEY isn't set, emails are logged instead of sent — so the rest
// of the app keeps working in environments where you haven't wired email yet.
export async function sendEmail({ to, subject, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[email:stubbed] to=${to} subject="${subject}"`);
    return { stubbed: true };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "BirdieGives <notifications@birdiegives.app>",
      to,
      subject,
      text,
    }),
  });

  if (!res.ok) {
    console.error("Resend error:", await res.text());
  }
  return { stubbed: false, ok: res.ok };
}
