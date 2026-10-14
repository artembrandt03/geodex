/**
 * A fake mail server for the end-to-end tests. The app is pointed at its SMTP
 * port instead of a real provider; every message it "sends" is kept in memory
 * and served over a tiny HTTP API so tests can read confirmation and reset
 * links:
 *
 *   GET    /health            200 once it's up
 *   GET    /messages?to=addr  messages for one recipient (all when omitted)
 *   DELETE /messages          forget everything
 *
 * Plain .mjs so Playwright's webServer can launch it with `node`.
 */
import http from "node:http";
import { SMTPServer } from "smtp-server";
import { simpleParser } from "mailparser";

const SMTP_PORT = Number(process.env.E2E_SMTP_PORT ?? 2526);
const API_PORT = Number(process.env.E2E_MAIL_API_PORT ?? 2527);

const messages = [];

const smtp = new SMTPServer({
  authOptional: true,
  disabledCommands: ["STARTTLS"],
  allowInsecureAuth: true,
  onAuth(_auth, _session, callback) {
    callback(null, { user: "e2e" });
  },
  onData(stream, session, callback) {
    simpleParser(stream)
      .then((parsed) => {
        for (const rcpt of session.envelope.rcptTo) {
          messages.push({
            to: rcpt.address.toLowerCase(),
            subject: parsed.subject ?? "",
            text: parsed.text ?? "",
            html: typeof parsed.html === "string" ? parsed.html : "",
            attachments: (parsed.attachments ?? []).length,
            replyTo: parsed.replyTo?.text ?? null,
            receivedAt: Date.now(),
          });
        }
        callback();
      })
      .catch(callback);
  },
});
smtp.on("error", (error) => console.error("[mail-sink] smtp error", error));
smtp.listen(SMTP_PORT, "127.0.0.1", () => console.log(`[mail-sink] smtp on ${SMTP_PORT}`));

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    res.setHeader("Content-Type", "application/json");

    if (url.pathname === "/health") {
      res.end(JSON.stringify({ ok: true }));
    } else if (url.pathname === "/messages" && req.method === "GET") {
      const to = url.searchParams.get("to")?.toLowerCase();
      res.end(JSON.stringify(to ? messages.filter((m) => m.to === to) : messages));
    } else if (url.pathname === "/messages" && req.method === "DELETE") {
      messages.length = 0;
      res.end(JSON.stringify({ ok: true }));
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: "not found" }));
    }
  })
  .listen(API_PORT, "127.0.0.1", () => console.log(`[mail-sink] http on ${API_PORT}`));
