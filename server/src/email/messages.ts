import { PROTECTED_HOME_ROUTE } from "@hvbc/contracts/routes";

import { escapeHtml, type EmailMessage } from "./sender";

export function welcomeEmail(to: string, name: string, appOrigin: string): EmailMessage {
  const safeName = escapeHtml(name);
  const safeOrigin = escapeHtml(appOrigin);
  return {
    to,
    subject: "Welcome",
    text: `Hello, ${name}. Your account has been created. Go to ${appOrigin}${PROTECTED_HOME_ROUTE} to get started.`,
    html: `<p>Hello, ${safeName}.</p><p>Your account has been created.</p><p><a href="${safeOrigin}${PROTECTED_HOME_ROUTE}">Go to your account</a></p>`
  };
}
