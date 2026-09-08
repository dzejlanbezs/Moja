/**
 * Checks the Pushover setup and sends one test notification.
 *
 *   node scripts/notify-test.js
 *
 * Plain CommonJS on purpose: it has to run on a host where only production
 * dependencies are installed.
 */
const fs = require("node:fs");
const path = require("node:path");

function loadEnvFile(file) {
  const filePath = path.join(process.cwd(), file);
  if (!fs.existsSync(filePath)) return false;

  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!match) continue;
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    if (!process.env[match[1]]) process.env[match[1]] = value;
  }
  return true;
}

function mask(value) {
  if (!value) return "(missing)";
  return `${value.slice(0, 4)}…${value.slice(-4)} (${value.length} chars)`;
}

async function main() {
  const loaded = [".env.local", ".env"].filter(loadEnvFile);
  console.log(`env files read: ${loaded.length ? loaded.join(", ") : "none — using the shell environment"}`);

  const token = process.env.PUSHOVER_TOKEN;
  const user = process.env.PUSHOVER_USER;
  console.log(`PUSHOVER_TOKEN: ${mask(token)}`);
  console.log(`PUSHOVER_USER:  ${mask(user)}`);
  console.log(`SITE_URL:       ${process.env.SITE_URL || "(not set — optional)"}`);

  if (!token || !user) {
    console.error(
      "\nNotifications are OFF. Create a file called .env.local next to package.json with:\n" +
        "\n  PUSHOVER_TOKEN=your-application-token" +
        "\n  PUSHOVER_USER=your-user-key\n" +
        "\nthen restart the app.",
    );
    process.exit(1);
  }

  const params = new URLSearchParams({
    token,
    user,
    title: "Aurea test",
    message: "If you can read this, notifications work.",
  });

  let response;
  try {
    response = await fetch("https://api.pushover.net/1/messages.json", { method: "POST", body: params });
  } catch (error) {
    console.error("\nCould not reach Pushover — the server may be blocking outgoing connections.");
    console.error(error);
    process.exit(1);
  }

  const text = await response.text();
  console.log(`\nPushover replied ${response.status}: ${text}`);

  if (response.ok && text.includes('"status":1')) {
    console.log("\nSent. Check your phone — the same keys are used by the site.");
    return;
  }

  console.error("\nPushover rejected it. 'application token is invalid' means PUSHOVER_TOKEN is wrong,");
  console.error("'user identifier is invalid' means PUSHOVER_USER is wrong.");
  process.exit(1);
}

main();
