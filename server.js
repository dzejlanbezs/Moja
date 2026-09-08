/**
 * Standalone entry point for hosts that start a Node app from a file
 * (Hostinger, cPanel/Passenger, Plesk, Railway, a bare VPS…).
 *
 * Point the host's "startup file" at server.js. It boots the production build,
 * so run `npm run build` before starting.
 */
const { createServer } = require("node:http");
const next = require("next");

const port = Number(process.env.PORT) || 3000;
const hostname = process.env.HOSTNAME || "0.0.0.0";

process.env.NODE_ENV = process.env.NODE_ENV || "production";

const app = next({ dev: false, dir: __dirname, hostname, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    createServer((req, res) => {
      handle(req, res).catch((error) => {
        console.error("Request failed:", error);
        res.statusCode = 500;
        res.end("Internal server error");
      });
    }).listen(port, hostname, () => {
      console.log(`Aurea is running on http://${hostname}:${port}`);
    });
  })
  .catch((error) => {
    console.error("Could not start the server:", error);
    process.exit(1);
  });
