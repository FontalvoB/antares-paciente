/** KAN-165 — Chromium, sesión sintética. Ejecutar con Vite en el origen indicado. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium, expect } from "playwright/test";

const origin = process.env.COP_E2E_APP_URL ?? "http://127.0.0.1:5186";
const patient = "11111111-1111-4111-8111-111111111111";
const token = "x." + Buffer.from(JSON.stringify({
  sub: patient, exp: Math.floor(Date.now() / 1000) + 86400,
})).toString("base64url") + ".x";
const fixtureGateway = process.env.COP_E2E_TAP_GATEWAY_URL;
const fixtureAudio = fixtureGateway ? readFileSync(process.env.COP_E2E_TAP_AUDIO_FILE) : null;
const browser = await chromium.launch();
try {
  for (const language of ["es", "en"]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 820 } });
    const sockets = [];
    let uploads = 0;
    // Interceptar antes de que Chromium pueda contactar a un tercero.
    await page.routeWebSocket("**/*", (socket) => {
      if (new URL(socket.url()).host === new URL(origin).host) return socket.connectToServer();
      sockets.push(new URL(socket.url()).hostname);
      socket.close();
    });
    await page.addInitScript(({ language, patient, recording }) => {
      localStorage.setItem("antares_lang", language);
      localStorage.setItem("wellness.plan.v1", JSON.stringify({
        name: "Synthetic Patient", goal: "bajar", startDate: new Date().toLocaleDateString("en-CA"),
        createdAt: new Date().toISOString(), totalDays: 365, kcal: 1660, proteinG: 115, carbsG: 201, fatG: 44, waterMl: 2500, weightKg: 80,
      }));
      localStorage.setItem("copp.ai-disclosure." + patient, JSON.stringify({
        version: "2026-11-21-health", acceptedAt: new Date().toISOString(),
      }));
      // Transmisión sintética, sin micrófono físico ni Web Speech del navegador.
      navigator.mediaDevices.getUserMedia = async () => ({
        getTracks: () => [{ stop: () => { window.fixtureMicStops = (window.fixtureMicStops ?? 0) + 1; } }],
      });
      window.MediaRecorder = class extends EventTarget {
        static isTypeSupported(type) { return type === "audio/webm;codecs=opus"; }
        mimeType = "audio/webm;codecs=opus";
        state = "inactive";
        start() { this.state = "recording"; }
        stop() {
          this.state = "inactive";
          const data = new Event("dataavailable");
          const payload = recording
            ? Uint8Array.from(atob(recording), (character) => character.charCodeAt(0))
            : "synthetic-turn";
          data.data = new Blob([payload], { type: this.mimeType });
          this.dispatchEvent(data);
          this.dispatchEvent(new Event("stop"));
        }
      };
      HTMLMediaElement.prototype.play = async function () {
        window.fixtureAudioPlayed = this.src.startsWith("blob:");
      };
    }, { language, patient, recording: fixtureAudio?.toString("base64") });

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
        case "/api/v1/chat/voice/turn": {
          uploads++;
          assert.equal(route.request().method(), "POST");
          assert.equal(route.request().headers()["x-vita-language"], language);
          assert.match(route.request().headers()["content-type"], /^audio\/webm/);
          if (fixtureAudio) assert.deepEqual(route.request().postDataBuffer(), fixtureAudio);
          else assert.equal(route.request().postData(), "synthetic-turn");
          if (uploads === 2) return route.fulfill({ status: 503, json: {} });
          if (fixtureGateway) {
            const upstream = await route.fetch({ url: new URL(path, fixtureGateway).href, maxRedirects: 0 });
            assert.equal(upstream.status(), 200);
            assert.equal(upstream.headers()["cache-control"], "no-store");
            const audio = Buffer.from((await upstream.json()).audioBase64, "base64");
            assert.equal(audio.toString("ascii", 0, 4), "RIFF");
            assert.ok(audio.length > 44);
            return route.fulfill({ response: upstream });
          }
          return reply({ transcript: "Synthetic transcript", reply: "Synthetic spoken answer", audioBase64: "UklGRg==" });
        }
        case "/api/v1/chat/voice/session":
          throw new Error("El modo privado no debe pedir sesión realtime.");
        default: return route.fulfill({ status: 404, json: {} });
      }
    });
    await page.goto(origin);
    const orb = page.locator("button.wh-orb-button");
    const dialog = page.locator("ion-modal.vita-panel-modal");
    await orb.click();
    const speak = dialog.getByRole("button", { name: language === "es" ? "Tocar para hablar" : "Tap to talk" });
    const send = dialog.getByRole("button", { name: language === "es" ? "Enviar grabación" : "Send recording" });
    await expect(speak).toBeVisible();
    await speak.click();
    await expect(send).toBeVisible();
    assert.equal(uploads, 0, "no enviar durante la grabación");
    await send.click();
    await expect(dialog.getByText("Synthetic spoken answer")).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.fixtureAudioPlayed)).toBe(true);
    assert.equal(await page.evaluate(() => window.fixtureMicStops), 1);
    await speak.click();
    await send.click();
    const unavailable = language === "es" ? "No se pudo completar el turno de voz." : "The voice turn could not be completed.";
    await expect(dialog.getByText(unavailable, { exact: false })).toBeVisible();
    assert.equal(uploads, 2);
    assert.deepEqual(sockets, []);
    await speak.click();
    await dialog.getByRole("button", { name: language === "es" ? "Cerrar Vita" : "Close Vita" }).click();
    await expect(dialog).not.toBeVisible();
    assert.equal(uploads, 2, "no enviar audio al cerrar");
    assert.equal(await page.evaluate(() => window.fixtureMicStops), 3);
    console.log(`${language}: graba, envía al gateway, reproduce y cancela sin proveedor externo`);
    await page.close();
  }
} finally {
  await browser.close();
}
