import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashAdminPassword } from "../lib/booking-auth.js";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const filename = path.join(project, ".env.local");
const reset = process.argv.includes("--reset-password");
const args = process.argv.slice(2);
if (args.some((value) => value !== "--reset-password")) throw new Error("Use npm run booking:setup [-- --reset-password].");
let contents;
try { contents = await readFile(filename, "utf8"); }
catch (error) { if (error.code !== "ENOENT") throw error; contents = await readFile(path.join(project, ".env.example"), "utf8"); }

function configured(name) { return contents.split(/\r?\n/).find((line) => line.startsWith(`${name}=`))?.slice(name.length + 1).trim(); }
function setValue(name, value) {
  const pattern = new RegExp(`^${name}=.*$`, "m");
  if (pattern.test(contents)) contents = contents.replace(pattern, `${name}=${value}`);
  else contents += `\n${name}=${value}\n`;
}

for (const name of ["BOOKING_SESSION_SECRET", "BOOKING_TOKEN_SECRET", "CRON_SECRET", "BOOKING_CALENDAR_TOKEN"]) {
  if (!configured(name)) setValue(name, randomBytes(32).toString("hex"));
}
let password;
if (reset || !configured("BOOKING_ADMIN_PASSWORD_HASH")) {
  password = randomBytes(24).toString("base64url");
  setValue("BOOKING_ADMIN_PASSWORD_HASH", await hashAdminPassword(password));
}
await writeFile(filename, contents, { mode: 0o600 });
if (password) {
  const directory = path.join(project, ".booking-data");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(path.join(directory, "admin-access.txt"), `Host sign-in: /admin/login\nPassword: ${password}\n\nStore this password in your password manager. This file is private and excluded from Git.\n`, { mode: 0o600 });
  process.stdout.write("Host credentials created. Read .booking-data/admin-access.txt privately; the password was not printed.\n");
} else process.stdout.write("Existing host password and booking secrets preserved.\n");
process.stdout.write("Restart the website after changes. Vercel also needs a remote libSQL database and the same private secrets.\n");
