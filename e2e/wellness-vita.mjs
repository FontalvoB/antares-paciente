/**
 * KAN-167 — Vita transversal. Chromium con sesión y respuestas sintéticas.
 * Ejecutar con Vite en 127.0.0.1:5182:
 *   COP_E2E_APP_URL=http://127.0.0.1:5182 node e2e/wellness-vita.mjs
 * Capturas fuera del repo (COP_E2E_SHOTS, por defecto .ai/operations/2026-11-25-ola4/kan167).
 */
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, expect } from "playwright/test";

const origin = process.env.COP_E2E_APP_URL ?? "http://127.0.0.1:5182";
const shots = process.env.COP_E2E_SHOTS
  ?? "C:/Users/Luis/Documents/CoppAddresd/Repos/.ai/operations/2026-11-25-ola4/kan167";
mkdirSync(shots, { recursive: true });
const id = "11111111-1111-4111-8111-111111111111";
const token = "x." + Buffer.from(JSON.stringify({
  sub: id, exp: Math.floor(Date.now() / 1000) + 86400,
})).toString("base64url") + ".x";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR2kAAAAASUVORK5CYII=", "base64");
const COPY = {
  es: { consent: "Acepto el uso de mis datos sensibles para mi plan de bienestar.", cont: "Continuar", voice: "Hablar con Vita", home: "Nutrición", ask: "Preguntar a Vita sobre", input: "Escribe un mensaje…", send: "Enviar", nudge: "Estoy aquí si quieres repasar tu día conmigo.", dismiss: "Descartar aviso de Vita", profile: "Perfil", exercise: "Ejercicio", image: "Imagen adjunta" },
  en: { consent: "I agree to the use of my sensitive data for my wellness plan.", cont: "Continue", voice: "Talk to Vita", home: "Nutrition", ask: "Ask Vita about", input: "Type a message…", send: "Send", nudge: "I am here if you want to go over your day with me.", dismiss: "Dismiss Vita notice", profile: "Profile", exercise: "Exercise", image: "Attached image" },
};

async function noOverflow(page, label) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    const scrollers = [...document.querySelectorAll(".screen-scroll, .vita-panel-log, .app-shell")];
    return root.scrollWidth > root.clientWidth + 1
      || scrollers.some((el) => el.scrollWidth > el.clientWidth + 1);
  });
  assert.equal(overflow, false, `overflow horizontal en ${label}`);
}

async function orbVisible(page, module, label) {
  const orb = page.locator(`[data-vita-module="${module}"] button.vita-entry-trigger`);
  await expect(orb).toBeVisible();
  // Espera a que terminen la transición de pantalla y la entrada del orbe.
  await page.waitForTimeout(500);
  const box = await orb.boundingBox();
  const viewport = page.viewportSize();
  assert.ok(box && box.x >= 0 && box.x + box.width <= viewport.width + 0.5, `orbe fuera del viewport en ${label}`);
  // No tapa la barra inferior: su borde inferior queda por encima de la nav.
  const nav = await page.locator("nav.bnav").boundingBox().catch(() => null);
  if (nav && box.y + box.height > nav.y + 0.5) {
    await page.screenshot({ path: join(shots, `kan167-FAIL-${label.replace(/\s+/g, "-")}.png`) });
    assert.fail(`orbe solapa la barra inferior en ${label}: orbe ${JSON.stringify(box)} nav ${JSON.stringify(nav)}`);
  }
  const sos = page.locator("ion-button.sos-quick-access");
  if (await sos.count()) {
    const sosBox = await sos.boundingBox();
    if (sosBox) assert.ok(box.y + box.height <= sosBox.y || box.y >= sosBox.y + sosBox.height, `orbe tapa el SOS en ${label}`);
  }
  return orb;
}

// COP_E2E_CHANNEL=chrome usa el Chrome del sistema si faltan los navegadores de Playwright.
const ALLOWED_CHAT_KEYS = new Set(["message", "supportsVita", "language", "moduleContext", "attachmentIds"]);
const SECRETS = ["11111111-1111-4111-8111-111111111111", "Paciente", "QA", "qa@example.test", "9988776655", "2025550101", "proactive-"];
function assertCleanBody(raw, label) {
  for (const secret of SECRETS) assert.ok(!raw.includes(secret), `${label} contiene dato personal o hilo: ${secret}`);
}
const voiceBodies = [];
const uploadBodies = [];
const browser = await chromium.launch(process.env.COP_E2E_CHANNEL ? { channel: process.env.COP_E2E_CHANNEL } : {});
const chatBodies = [];
try {
  for (const lang of ["es", "en"]) {
    for (const width of lang === "es" ? [320, 390, 768] : [390]) {
      const c = COPY[lang];
      const tag = `${lang}-${width}`;
      const context = await browser.newContext({ viewport: { width, height: 820 } });
      const page = await context.newPage();
      page.setDefaultTimeout(8000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const mocked404 = new Set();
      page.on("console", (msg) => {
        // Los 404 del catch-all de rutas no simuladas se registran aparte.
        if (msg.type() === "error" && !/status of 404/.test(msg.text())) errors.push(`console: ${msg.text()}`);
      });
      page.on("response", (response) => {
        if (response.status() !== 404) return;
        const path = new URL(response.url()).pathname;
        if (path.startsWith("/api/")) mocked404.add(path);
        else errors.push(`404 fuera de la API simulada: ${path}`);
      });
      await page.addInitScript(({ patientId, language }) => {
        const now = new Date();
        const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
        localStorage.setItem("antares_lang", language);
        localStorage.setItem("wellness.plan.v1", JSON.stringify({
          name: "Paciente QA", goal: "bajar", startDate: date, createdAt: now.toISOString(),
          totalDays: 365, kcal: 1660, proteinG: 115, carbsG: 201, fatG: 44, waterMl: 2500,
          weightKg: 80, vegetarian: true, dairyFree: true,
        }));
        localStorage.setItem("copp.ai-disclosure." + patientId, JSON.stringify({
          version: "2026-11-21-health", acceptedAt: now.toISOString(),
        }));
      }, { patientId: id, language: lang });
      await page.route("**/api/**", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const reply = (json) => route.fulfill({ json });
        if (url.pathname === "/api/auth/refresh") return reply({ accessToken: token, expiresIn: 86400 });
        if (url.pathname === "/api/auth/me") return reply({ id, firstName: "Paciente", lastName: "QA", email: "qa@example.test", roles: ["Patient"], permissions: [] });
        if (url.pathname === "/api/v1/me/patient-profile") {
          return reply({ patientId: id, firstName: "Paciente", lastName: "QA", documentNumber: "9988776655", phone: "+12025550101" });
        }
        if (url.pathname === "/api/v1/me/context") return reply({ patient: { id, organizationId: id }, clinics: [] });
        if (url.pathname === "/api/v1/me/legal-consents") {
          return reply({ locale: lang, scopes: ["chat", "food", "voice"].map((scope) => ({
            scope, available: true, accepted: true, disclosureId: "qa", receiptId: "qa",
            documents: [{ locale: lang, versionId: "qa", content: "Consentimiento de prueba" }],
          })) });
        }
        if (url.pathname === "/api/v1/chat/voice/session" && request.method() === "POST") {
          voiceBodies.push(request.postData() ?? "");
          // Sesión sin credencial: el cliente la trata como voz no disponible.
          return reply({});
        }
        if (url.pathname === "/api/v1/vita/attachments" && request.method() === "POST") {
          uploadBodies.push(request.postDataBuffer()?.toString("latin1") ?? "");
          return reply({ attachmentId: "att-qa", kind: "image", contentType: "image/png", sizeBytes: PNG.length,
            pageCount: null, expiresAt: new Date(Date.now() + 600_000).toISOString() });
        }
        if (url.pathname === "/api/v1/chat" && request.method() === "POST") {
          const raw = request.postData() ?? "";
          const body = JSON.parse(raw);
          chatBodies.push(body);
          // Todas las propiedades del cuerpo: sin hilo ni identificadores.
          for (const key of Object.keys(body)) assert.ok(ALLOWED_CHAT_KEYS.has(key), `propiedad no permitida en /chat: ${key}`);
          assertCleanBody(raw, "cuerpo de /api/v1/chat");
          return reply({ reply: lang === "en" ? "Try one small step today." : "Prueba un paso pequeño hoy.", threadId: body.threadId, executionId: `exec-${chatBodies.length}` });
        }
        if (/^\/api\/v1\/threads\//.test(url.pathname)) return reply({ threadId: "t", messageCount: 0, lastMessage: null, messages: [] });
        return route.fulfill({ status: 404, json: {} });
      });

      await page.goto(origin);
      // Home: orbe visible y aviso proactivo una vez.
      const homeOrb = await orbVisible(page, "home", `home ${tag}`);
      await expect(homeOrb).toHaveAttribute("aria-expanded", "false");
      await expect(homeOrb).toHaveAttribute("aria-label", new RegExp(`^${c.ask}`));
      const nudge = page.getByText(c.nudge);
      await expect(nudge).toBeVisible();
      await page.waitForTimeout(600);
      await page.screenshot({ path: join(shots, `kan167-home-nudge-${tag}.png`) });
      await page.getByRole("button", { name: c.dismiss }).click();
      await expect(nudge).toHaveCount(0);
      await noOverflow(page, `home ${tag}`);

      // Teclado: el orbe se activa con Enter, Escape cierra y el foco vuelve.
      await homeOrb.focus();
      await page.keyboard.press("Enter");
      const dialog = page.locator("ion-modal.vita-panel-modal");
      await expect(dialog.locator("h2", { hasText: "Vita" })).toBeVisible();
      await page.waitForTimeout(400);
      await page.screenshot({ path: join(shots, `kan167-panel-home-${tag}.png`) });
      await noOverflow(page, `panel home ${tag}`);
      // Foco visible del campo de texto (anillo en el compositor).
      await expect.poll(() => page.evaluate(() => {
        const composer = document.querySelector(".vita-panel-composer");
        return composer ? getComputedStyle(composer).boxShadow : "";
      })).toMatch(/rgb\(3, 93, 77\) 0px 0px 0px 2px/);
      // Recordatorio superior con el panel abierto: queda bajo la cabecera.
      const toastTop = await page.evaluate(async () => {
        const toast = document.createElement("ion-toast");
        toast.className = "app-toast wellness-reminder-toast";
        toast.message = "Recordatorio QA";
        toast.position = "top";
        toast.duration = 0;
        document.body.appendChild(toast);
        await toast.present();
        await new Promise((resolve) => setTimeout(resolve, 600));
        const wrapper = toast.shadowRoot.querySelector(".toast-wrapper").getBoundingClientRect();
        const head = document.querySelector(".vita-panel-note").getBoundingClientRect();
        await toast.dismiss();
        toast.remove();
        return { toast: wrapper.top, head: head.bottom };
      });
      assert.ok(toastTop.toast >= toastTop.head - 1, `recordatorio tapa la cabecera o la nota del panel ${JSON.stringify(toastTop)}`);
      // Foco atrapado: Tab nunca sale del panel.
      for (let index = 0; index < 12; index += 1) {
        await page.keyboard.press("Tab");
        assert.equal(await page.evaluate(() => Boolean(document.activeElement?.closest("ion-modal.vita-panel-modal"))), true, `foco fuera del panel (${tag}, tab ${index + 1})`);
      }
      await page.keyboard.press("Escape");
      await expect(page.locator("ion-modal.vita-panel-modal.show-modal")).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => Boolean(document.activeElement?.closest(".vita-entry-trigger")))).toBe(true);

      // Home: enviar texto.
      await homeOrb.click();
      await dialog.getByRole("textbox", { name: c.input }).fill(lang === "en" ? "What should I do now?" : "¿Qué hago ahora?");
      await dialog.locator("ion-button.vita-panel-send").click();
      await expect(dialog.getByText(lang === "en" ? "Try one small step today." : "Prueba un paso pequeño hoy.")).toBeVisible();
      const homeBody = chatBodies.at(-1);
      assert.equal(homeBody.moduleContext.module, "home");
      assert.equal(homeBody.supportsVita, true);
      await page.keyboard.press("Escape");
      await expect(page.locator("ion-modal.vita-panel-modal.show-modal")).toHaveCount(0);

      // Dieta: orbe, texto + imagen simulada.
      await page.locator(".wh-quick").getByRole("button", { name: c.home, exact: true }).click();
      const dietOrb = await orbVisible(page, "diet", `diet ${tag}`);
      await noOverflow(page, `diet ${tag}`);
      await dietOrb.click();
      await dialog.locator("input[data-vita-file-input]").setInputFiles({ name: "plato.png", mimeType: "image/png", buffer: PNG });
      await expect(dialog.getByText(c.image).first()).toBeVisible();
      await dialog.getByRole("textbox", { name: c.input }).fill(lang === "en" ? "Is this plate in my plan?" : "¿Este plato encaja en mi plan?");
      await dialog.locator("ion-button.vita-panel-send").click();
      await expect(dialog.getByText(lang === "en" ? "Try one small step today." : "Prueba un paso pequeño hoy.")).toBeVisible();
      const dietBody = chatBodies.at(-1);
      assert.equal(dietBody.moduleContext.module, "diet");
      assert.deepEqual(dietBody.attachmentIds, ["att-qa"]);
      const upload = uploadBodies.at(-1);
      assert.ok(upload && !upload.includes('name="threadId"'), "la subida no debe enviar threadId");
      assert.ok(upload.includes('filename="adjunto.png"') && !upload.includes("plato.png"), "la subida debe usar un nombre neutro");
      // El fichero es binario: se comprueban solo identificadores inequívocos.
      for (const secret of ["11111111-1111-4111-8111-111111111111", "qa@example.test", "9988776655", "proactive-"]) {
        assert.ok(!upload.includes(secret), `subida de adjunto contiene ${secret}`);
      }
      // Voz desde Dieta: la sesión recibe el origen del módulo y ningún hilo.
      await dialog.getByRole("button", { name: c.voice }).click();
      await expect.poll(() => voiceBodies.length).toBeGreaterThan(0);
      const voiceBody = JSON.parse(voiceBodies.at(-1));
      assert.equal(voiceBody.moduleContext?.module, "diet");
      assert.equal("threadId" in voiceBody, false);
      assertCleanBody(voiceBodies.at(-1), "cuerpo de voz");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
      if (await page.locator("ion-modal.vita-panel-modal.show-modal").count()) {
        await page.keyboard.press("Escape");
      }
      const sendState = await dialog.locator("ion-button.vita-panel-send").evaluate((el) => ({
        disabled: el.classList.contains("button-disabled"),
        background: getComputedStyle(el.shadowRoot.querySelector(".button-native")).backgroundColor,
      }));
      console.log(`  enviar tras respuesta ${tag}: ${JSON.stringify(sendState)}`);
      await page.mouse.move(1, 1);
      await page.waitForTimeout(200);
      await page.screenshot({ path: join(shots, `kan167-panel-diet-${tag}.png`) });
      await noOverflow(page, `panel diet ${tag}`);

      // Cerrar cualquier capa restante (voz o panel) antes de navegar.
      for (let index = 0; index < 3 && await page.locator("ion-modal.show-modal").count(); index += 1) {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(350);
      }
      await expect(page.locator("ion-modal.show-modal")).toHaveCount(0);

      // Ejercicio pasa por el consentimiento real de datos sensibles (KAN-157).
      await page.locator("nav.bnav").getByRole("button", { name: c.exercise }).click();
      await orbVisible(page, "privacy", `consentimiento ${tag}`);
      await noOverflow(page, `consentimiento ${tag}`);
      await page.getByRole("checkbox", { name: c.consent }).click();
      await page.getByRole("button", { name: c.cont, exact: true }).click();
      await orbVisible(page, "exercise", `exercise ${tag}`);
      await noOverflow(page, `exercise ${tag}`);
      await page.locator("nav.bnav").getByRole("button", { name: c.profile }).click();
      await orbVisible(page, "profile", `profile ${tag}`);
      await noOverflow(page, `profile ${tag}`);
      await page.screenshot({ path: join(shots, `kan167-profile-${tag}.png`) });

      // Minimizar a pestaña y restaurar.
      await page.locator('[data-vita-module="profile"] button.vita-entry-trigger').click();
      await dialog.getByRole("button", { name: lang === "en" ? "Minimize Vita" : "Minimizar Vita" }).click();
      const tab = page.getByRole("button", { name: lang === "en" ? "Show Vita" : "Mostrar a Vita" });
      await expect(tab).toBeVisible();
      await expect(page.locator("ion-modal.vita-panel-modal.show-modal")).toHaveCount(0);
      await page.waitForTimeout(500);
      await page.screenshot({ path: join(shots, `kan167-minimized-${tag}.png`) });
      await tab.click();
      await orbVisible(page, "profile", `profile restore ${tag}`);

      // Sin pantalla de chat independiente.
      assert.equal(await page.locator(".chat-reference, .chat-list, .chat-composer").count(), 0);

      // Ningún payload lleva datos personales.
      for (const body of chatBodies) {
        assert.equal("threadId" in body, false, "el chat no debe enviar threadId");
        const context = JSON.stringify(body.moduleContext);
        for (const secret of [id, "Paciente", "QA", "qa@example.test", "9988776655", "2025550101"]) {
          assert.ok(!context.includes(secret), `moduleContext con dato personal: ${secret}`);
        }
      }
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS vita ${tag}${mocked404.size ? ` (API no simulada → 404: ${[...mocked404].join(", ")})` : ""}`);
    }
  }
} finally {
  await browser.close();
}
