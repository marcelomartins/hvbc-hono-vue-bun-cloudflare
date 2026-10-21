import { randomBytes } from "node:crypto";

// Creates .dev.vars from the example when it is missing, with a session secret generated
// on this machine. The secret is never committed or shared, and an existing file is kept
// as is, so a configuration the developer wrote is never overwritten.
const devVars = Bun.file(".dev.vars");

if (!(await devVars.exists())) {
  const example = await Bun.file(".dev.vars.example").text();
  const secret = randomBytes(32).toString("base64url");
  await Bun.write(devVars, example.replace(/^SESSION_SECRET=(?=\r?$)/mu, `SESSION_SECRET=${secret}`));
  console.info("Created .dev.vars with a fresh SESSION_SECRET.");
}
