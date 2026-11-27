/**
 * Inicio de bienestar: navegación y entrada de Vita con sesión y red simuladas.
 * En otra terminal: npm run dev -- --host 127.0.0.1 --port 5182
 * Ejecutar: node --test e2e/wellness-home-vita.mjs
 * Capturas opcionales: COP_E2E_SHOTS=/tmp/wellness-home-vita-qa
 */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { chromium, expect } from "playwright/test";

const origin = process.env.COP_E2E_APP_URL ?? "http://127.0.0.1:5182";
const channel = process.env.COP_E2E_BROWSER_CHANNEL ?? process.env.COP_E2E_CHANNEL;
const screenshots = process.env.COP_E2E_SHOTS;
const accountId = "11111111-1111-4111-8111-111111111111";
const token = "x." + Buffer.from(JSON.stringify({
  sub: accountId, exp: Math.floor(Date.now() / 1000) + 86400,
})).toString("base64url") + ".x";
const answer = "Empieza con un paso pequeño hoy.";
const names = ["Nutrición", "Rutina de ejercicios", "Sueño", "Medicamentos"];

let browser;
before(async () => {
  if (screenshots) await mkdir(screenshots, { recursive: true });
  browser = await chromium.launch(channel ? { channel } : {});
});
after(async () => { await browser?.close(); });

async function openHome(t, { width = 390, reducedMotion = "no-preference", lang = "es" } = {}) {
  const date = new Date().toISOString().slice(0, 10);
  const context = await browser.newContext({
    viewport: { width, height: 870 }, reducedMotion, locale: lang === "es" ? "es-CO" : "en-US", timezoneId: "UTC",
  });
  t.after(() => context.close());
  const page = await context.newPage();
  const chat = [];
  const voice = [];

  await page.addInitScript(({ language, id, startDate }) => {
    const now = new Date();
    localStorage.setItem("antares_lang", language);
    localStorage.setItem("wellness.plan.v1", JSON.stringify({
      name: "Paciente QA", goal: "bajar", startDate, createdAt: now.toISOString(),
      totalDays: 365, kcal: 1660, proteinG: 115, carbsG: 201, fatG: 44, waterMl: 2500,
    }));
    localStorage.setItem("copp.ai-disclosure." + id, JSON.stringify({
      version: "2026-11-21-health", acceptedAt: now.toISOString(),
    }));
    localStorage.setItem("wellness.reminder-preferences.v1." + id, JSON.stringify({
      protocol: { enabled: false }, chest: { enabled: false }, streak: { enabled: false }, ai: { enabled: false },
    }));
  }, { language: lang, id: accountId, startDate: date });

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const { pathname, searchParams } = new URL(request.url());
    const reply = (json) => route.fulfill({ json });

    switch (pathname) {
      case "/api/auth/refresh":
        return reply({ accessToken: token, expiresIn: 86400 });
      case "/api/auth/me":
        return reply({ id: accountId, firstName: "Paciente", lastName: "QA", roles: ["Patient"], permissions: [] });
      case "/api/v1/me/patient-profile":
        return reply({ patientId: accountId, firstName: "Paciente", lastName: "QA" });
      case "/api/v1/me/context":
        return reply({ patient: { id: accountId, organizationId: accountId }, clinics: [] });
      case "/api/v1/people/me/plan":
        return reply({
          today: 1, todayLocalDate: date, timeZoneId: "UTC", status: { state: "active" },
          logStatus: "open", streak: 0, real: true,
          ...(searchParams.has("includeSync") ? { sync: { personId: accountId, logs: [], events: [] } } : {}),
        });
      case "/api/v1/me/legal-consents":
        return reply({
          locale: lang,
          scopes: ["chat", "food", "voice"].map((scope) => ({
            scope, available: true, accepted: true, disclosureId: "qa", receiptId: "qa",
            documents: [{ locale: lang, versionId: "qa", content: "Consentimiento de prueba" }],
          })),
        });
      case "/api/v1/chat":
        if (request.method() !== "POST") break;
        chat.push(request.postDataJSON());
        return reply({ reply: answer, executionId: "text-qa" });
      case "/api/v1/chat/voice/session":
        if (request.method() !== "POST") break;
        voice.push(request.postDataJSON());
        // Verifica la entrada de voz sin iniciar una llamada de proveedor.
        return reply({});
    }
    return route.fulfill({ status: 404, json: {} });
  });

  await page.goto(origin);
  // No confundir un fallo de sesión con la ausencia de la función nueva.
  await expect(page.getByRole("heading", { name: /^(¡Hola|Hi|Hello)/ })).toBeVisible();
  return { page, chat, voice };
}

function quickActions(page, lang = "es") {
  return page.getByRole("region", { name: lang === "es" ? "Accesos rápidos" : "Quick actions" });
}

async function noHorizontalOverflow(page) {
  assert.equal(await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth > root.clientWidth + 1 || [...document.querySelectorAll(".screen-scroll")]
      .some((el) => !["hidden", "clip"].includes(getComputedStyle(el).overflowX) && el.scrollWidth > el.clientWidth + 1);
  }), false, "ninguna pantalla debe desplazar horizontalmente");
}

test("las cuatro tarjetas cargan sus imágenes y se mantienen accesibles en móvil y escritorio", { concurrency: true }, async (t) => {
  await Promise.all([
    { width: 320, reducedMotion: "reduce" },
    { width: 390 },
    { width: 1280, lang: "en" },
  ].map((view) => t.test(`${view.width}px ${view.lang ?? "es"}`, async (sub) => {
    const { page } = await openHome(sub, view);
    const quick = quickActions(page, view.lang);
    await expect(quick).toBeVisible({ timeout: 3000 });
    const labels = view.lang === "en" ? ["Nutrition", "Exercise routine", "Sleep", "Medications"] : names;
    const bounds = [];
    for (const name of labels) {
      const card = quick.getByRole("button", { name, exact: true });
      await expect(card).toBeVisible();
      await expect.poll(() => card.evaluate((button) => {
        const root = button.getRootNode();
        const photo = (root instanceof ShadowRoot ? root.host : button).querySelector("img");
        return Boolean(photo?.complete && photo.naturalWidth > 0);
      })).toBe(true);
      const box = await card.boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= view.width + 1 && box.height >= 44, name);
      bounds.push(box);
    }
    if (view.width === 1280) {
      assert.ok(bounds.every((box) => Math.abs(box.y - bounds[0].y) <= 1), "una fila de accesos en escritorio");
    }
    const composer = page.locator("[data-vita-home-composer]");
    const animation = await composer.evaluate((el) => {
      const pulse = getComputedStyle(el.querySelector(".vita-home-mic"), "::after");
      return { reveal: getComputedStyle(el).animationName, pulse: pulse.animationName, repeat: Number(pulse.animationIterationCount) };
    });
    if (view.reducedMotion === "reduce") {
      assert.equal(animation.reveal, "none", "sin animación de entrada con movimiento reducido");
      assert.equal(animation.pulse, "none", "sin pulso del micrófono con movimiento reducido");
    } else {
      assert.notEqual(animation.reveal, "none", "el compositor anima su entrada");
      assert.notEqual(animation.pulse, "none", "el micrófono pulsa al entrar");
      assert.ok(Number.isFinite(animation.repeat) && animation.repeat > 0, "el pulso no se repite continuamente");
    }
    await noHorizontalOverflow(page);
    if (screenshots) await page.screenshot({ path: join(screenshots, `inicio-${view.width}.png`), animations: "disabled" });
    if (view.width === 320) {
      const position = await page.evaluate(async () => {
        const toast = document.createElement("ion-toast");
        toast.className = "app-toast wellness-reminder-toast";
        toast.message = "Recordatorio de prueba";
        toast.position = "top";
        toast.animated = false;
        document.body.appendChild(toast);
        await toast.present();
        try {
          return {
            top: toast.shadowRoot.querySelector(".toast-wrapper").getBoundingClientRect().top,
            toolbarBottom: document.querySelector(".wh-toolbar").getBoundingClientRect().bottom,
          };
        } finally {
          await toast.dismiss();
          toast.remove();
        }
      });
      assert.ok(position.top >= position.toolbarBottom, "el recordatorio no cubre la barra con el acceso a SOS");
    }
  })));
});

test("cada acceso abre el módulo previsto y la medicina conserva su disponibilidad actual", async (t) => {
  const { page } = await openHome(t);
  const quick = quickActions(page);
  const open = (name) => quick.getByRole("button", { name, exact: true }).click({ timeout: 3000 });

  await open("Nutrición");
  await expect(page.getByRole("heading", { name: "Dieta de hoy" })).toBeVisible();
  await page.locator("nav.bnav").getByRole("button", { name: "Inicio", exact: true }).click();

  await open("Rutina de ejercicios");
  const consent = page.getByRole("checkbox", { name: "Acepto el uso de mis datos sensibles para mi plan de bienestar." });
  await expect(consent).toBeVisible();
  await consent.click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.locator('[data-vita-module="exercise"]')).toBeVisible();
  await page.locator("nav.bnav").getByRole("button", { name: "Inicio", exact: true }).click();

  await open("Sueño");
  await expect(page.getByRole("heading", { name: "Cerrar el día" })).toBeVisible();
  await expect(page.getByLabel("Horas de sueño")).toBeVisible();
  await page.locator("nav.bnav").getByRole("button", { name: "Inicio", exact: true }).click();

  await open("Medicamentos");
  await expect(page.getByRole("dialog")).toBeVisible();
  const preview = page.locator("ion-modal").filter({ has: page.getByRole("heading", { name: "Medicamentos" }) });
  await expect(preview.getByText("Próximamente", { exact: true })).toBeVisible();
  await preview.getByRole("button", { name: "Volver", exact: true }).click();
  await expect(preview).toBeHidden();

  await open("Ver todos");
  await expect(page.getByRole("heading", { name: "Tu Plan de Bienestar" })).toBeVisible();
});

test("el compositor de Inicio envía texto a Vita y abre su flujo de micrófono", async (t) => {
  const { page, chat, voice } = await openHome(t, { width: 320, reducedMotion: "reduce" });
  const composer = page.locator("[data-vita-home-composer]");
  await expect(composer).toBeVisible({ timeout: 3000 });
  const input = composer.getByRole("textbox", { name: "Escribe a Vita…" });
  const send = composer.getByRole("button", { name: "Enviar", exact: true });
  const microphone = composer.getByRole("button", { name: "Hablar con Vita", exact: true });
  const panel = page.locator('[data-vita-panel="home"]');

  await expect(send).toBeDisabled();
  await expect(microphone).toBeVisible();
  await expect(input).toBeVisible();
  await noHorizontalOverflow(page);

  const first = "¿Qué puedo priorizar hoy?";
  await input.fill(first);
  await expect(send).toBeEnabled();
  await send.click();
  await expect(panel.getByText(first, { exact: true })).toBeVisible();
  await expect(panel.getByText(answer, { exact: true })).toBeVisible();
  assert.equal(chat.length, 1);
  assert.equal(chat[0].message, first);
  assert.equal(chat[0].moduleContext.module, "home");
  assert.equal("threadId" in chat[0], false);

  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(input).toHaveValue("");

  const second = "¿Cómo organizo mi tarde?";
  await input.fill(second);
  await input.press("Enter");
  await expect(panel.getByText(second, { exact: true })).toBeVisible();
  await expect.poll(() => chat.length).toBe(2);
  assert.equal(chat[1].message, second);
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();

  const unfinished = "Un mensaje con adjunto";
  await input.fill(unfinished);
  await composer.getByRole("button", { name: "Adjuntar al chat" }).click();
  const attachments = page.locator("ion-action-sheet");
  await expect(attachments.getByRole("button", { name: "Tomar foto" })).toBeVisible();
  await expect(attachments.getByRole("button", { name: "Fotos" })).toBeVisible();
  await expect(attachments.getByRole("button", { name: "Archivo" })).toBeVisible();
  const cancel = attachments.getByRole("button", { name: "Cancelar" });
  await cancel.click();
  await expect(cancel).toBeHidden();
  await expect(panel.getByRole("textbox", { name: "Escribe un mensaje…" })).toHaveValue(unfinished);
  assert.equal(chat.length, 2, "abrir el selector no envía el texto sin confirmar");
  await panel.getByRole("button", { name: "Cerrar Vita" }).click();
  await expect(panel).toBeHidden();

  await microphone.click();
  await expect(page.locator("ion-modal.voice-modal.show-modal")).toBeVisible();
  await expect.poll(() => voice.length).toBeGreaterThan(0);
  assert.equal(voice[0].moduleContext.module, "home");
  assert.equal("threadId" in voice[0], false);
});
