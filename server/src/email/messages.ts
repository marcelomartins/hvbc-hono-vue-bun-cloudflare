import { escapeHtml, type EmailMessage } from "./sender";

export function welcomeEmail(to: string, name: string, appOrigin: string): EmailMessage {
  const safeName = escapeHtml(name);
  const safeOrigin = escapeHtml(appOrigin);
  return {
    to,
    subject: "Welcome",
    text: `Hello, ${name}. Your account has been created. Go to ${appOrigin}/dashboard to get started.`,
    html: `<p>Hello, ${safeName}.</p><p>Your account has been created.</p><p><a href="${safeOrigin}/dashboard">Go to your account</a></p>`
  };
}
