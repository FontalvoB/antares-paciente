/** KAN-165 — Chromium, sesión sintética. Ejecutar con Vite en el origen indicado. */
import assert from "node:assert/strict";
import { chromium, expect } from "playwright/test";

const origin = process.env.COP_E2E_APP_URL ?? "http://127.0.0.1:5184";
const patient = "11111111-1111-4111-8111-111111111111";
const token = "x." + Buffer.from(JSON.stringify({
  sub: patient, exp: Math.floor(Date.now() / 1000) + 86400,
})).toString("base64url") + ".x";
const browser = await chromium.launch();
try {
  for (const language of ["es", "en"]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 820 } });
    const sockets = [];
    // Interceptar antes de que Chromium pueda contactar a un tercero.
    await page.routeWebSocket("**/*", (socket) => {
      if (new URL(socket.url()).host === new URL(origin).host) return socket.connectToServer();
      sockets.push(new URL(socket.url()).hostname);
      socket.close();
    });
    await page.addInitScript(({ language, patient }) => {
      localStorage.setItem("antares_lang", language);
      localStorage.setItem("wellness.plan.v1", JSON.stringify({
        name: "Synthetic Patient", goal: "bajar", startDate: new Date().toLocaleDateString("en-CA"),
        createdAt: new Date().toISOString(), totalDays: 365, kcal: 1660, proteinG: 115, carbsG: 201, fatG: 44, waterMl: 2500, weightKg: 80,
      }));
      localStorage.setItem("copp.ai-disclosure." + patient, JSON.stringify({
        version: "2026-11-21-health", acceptedAt: new Date().toISOString(),
      }));
      // Darle oportunidad al SDK de llegar a WebSocket sin micrófono físico.
      const audio = new AudioContext();
      navigator.mediaDevices.getUserMedia = async () => audio.createMediaStreamDestination().stream;
      window.SpeechRecognition = class {};
    }, { language, patient });
    let voiceRequests = 0;
    let chatRequests = 0;
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      const reply = (json) => route.fulfill({ json });
      switch (path) {
        case "/api/auth/refresh": return reply({ accessToken: token, expiresIn: 86400 });
        case "/api/auth/me": return reply({ id: patient, firstName: "Synthetic", lastName: "Patient", roles: ["Patient"], permissions: [] });
        case "/api/v1/me/patient-profile": return reply({ patientId: patient, firstName: "Synthetic", lastName: "Patient" });
        case "/api/v1/me/context": return reply({ patient: { id: patient, organizationId: patient }, clinics: [] });
        case "/api/v1/me/legal-consents": return reply({
          locale: language, scopes: ["chat", "voice"].map((scope) => ({
            scope, available: true, accepted: true, receiptId: "qa", disclosureId: "qa",
            documents: [{ locale: language, versionId: "qa", content: "Synthetic consent" }],
          })),
        });
        case "/api/v1/chat/voice/session":
          voiceRequests++;
          return reply({
            signedUrl: "wss://voice-provider.example.test/v1/conversation?token=synthetic",
            agentId: "qa", runtimeMode: "legacy",
          });
        case "/api/v1/chat":
          chatRequests++;
          return reply({ reply: "Synthetic text reply", threadId: "qa" });
        default: return route.fulfill({ status: 404, json: {} });
      }
    });
    await page.goto(origin);
    const orb = page.locator("button.wh-orb-button");
    const dialog = page.locator("ion-modal.vita-panel-modal");
    const voice = language === "es" ? "Hablar con Vita" : "Talk to Vita";
    await orb.click();
    await dialog.getByRole("button", { name: voice, exact: true }).click();
    await expect.poll(() => voiceRequests).toBeGreaterThan(0);
    // La versión sin el control intenta conectar antes de presentar el fallback.
    const fallback = page.getByRole("button", { name: language === "es" ? "Usar chat de texto" : "Use text chat" });
    await expect.poll(async () => sockets.length ? "external-socket" : await fallback.isVisible() ? "text-only" : "pending").toBe("text-only");
    assert.deepEqual(sockets, [], "el cliente intentó abrir un WebSocket con el proveedor");
    await expect(page.getByRole("button", { name: /voz del dispositivo|device voice/i })).toHaveCount(0);
    await fallback.click();
    await expect(fallback).toHaveCount(0);
    if (!(await dialog.isVisible())) await orb.click();
    await dialog.getByRole("textbox").fill("Synthetic question");
    await dialog.locator("ion-button.vita-panel-send").click();
    await expect(dialog.getByText("Synthetic text reply")).toBeVisible();
    assert.equal(chatRequests, 1);
    console.log(`${language}: sin WebSocket externo ni reconocimiento remoto, chat de texto disponible`);
    await page.close();
  }
} finally {
  await browser.close();
}
