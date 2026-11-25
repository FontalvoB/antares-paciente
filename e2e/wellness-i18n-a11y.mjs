/** Cierre del día en Chromium con Vite en 127.0.0.1:5181. */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium, expect } from "playwright/test";

const origin = "http://127.0.0.1:5181";
const output = process.env.KAN147_SCREENSHOTS ??
  "C:/Users/Luis/Documents/CoppAddresd/Repos/.ai/operations/2026-11-25-ola4/kan147";
const id = "11111111-1111-4111-8111-111111111111";
const token = "x." + Buffer.from(JSON.stringify({
  sub: id, exp: Math.floor(Date.now() / 1000) + 86400,
})).toString("base64url") + ".x";
const scenarios = {
  es: {
    close: "Cerrar el día", closed: "Día cerrado", form: "Registro de hoy",
    fields: ["Adherencia (%)", "Horas de sueño", "Energía (1–5)", "Dolor (0–10)"],
    weight: "Peso (kg, opcional)", waist: "Cintura (cm, opcional)",
    weightValue: "72,5", waistValue: "80,5", metric: [72.5, 80.5],
    symptom: "Náuseas", exercise: "¿Hiciste ejercicio hoy?", yes: "Sí",
    error: "Revisa los valores e indica si hiciste ejercicio.", summary: "Tu plan para mañana",
  },
  en: {
    close: "Close the day", closed: "Day closed", form: "Today's check-in",
    fields: ["Adherence (%)", "Hours of sleep", "Energy (1–5)", "Pain (0–10)"],
    weight: "Weight (lb, optional)", waist: "Waist (in, optional)",
    weightValue: "160", waistValue: "32", metric: [72.5747792, 81.28],
    symptom: "Nausea", exercise: "Did you exercise today?", yes: "Yes",
    error: "Check your entries and indicate whether you exercised.", summary: "Your plan for tomorrow",
  },
};

async function assertNoOverflow(page) {
  const overflow = await page.evaluate(() => {
    const labels = document.querySelectorAll(".wc-scroll :is(h1,h2,.label-text-wrapper)");
    return [document.documentElement, document.querySelector(".app-shell"), document.querySelector(".wc-scroll"), ...labels]
      .filter((node) => node && node.clientWidth && node.scrollWidth > node.clientWidth + 1)
      .map((node) => node.className);
  });
  assert.deepEqual(overflow, []);
}

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.KAN147_CHROMIUM_CHANNEL });
let browserPid;
try {
  const cdp = await browser.newBrowserCDPSession();
  const { processInfo } = await cdp.send("SystemInfo.getProcessInfo");
  browserPid = processInfo.find(({ type }) => type === "browser")?.id;
  assert.ok(browserPid, "No se pudo identificar el PID de Chromium");
  await cdp.detach();
  console.log(`Chromium PID ${browserPid}`);
  for (const [lang, copy] of Object.entries(scenarios)) {
    for (const width of [320, 390, 768]) {
      const context = await browser.newContext({
        locale: lang === "es" ? "es-CO" : "en-US",
        viewport: { width, height: 820 },
        reducedMotion: "reduce",
      });
      try {
        const page = await context.newPage();
        const errors = [];
        const consoleErrors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => {
          if (message.type() === "error" || /\[(?:i18n|appointments|thread)\]/.test(message.text())) {
            consoleErrors.push(message.text());
          }
        });
        await page.addInitScript(({ id, lang, token }) => {
          const now = new Date();
          const startDate = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"),
            String(now.getDate()).padStart(2, "0")].join("-");
          localStorage.setItem("antares_lang", lang);
          localStorage.setItem("copp_access_token", token);
          localStorage.setItem("wellness.plan.v1", JSON.stringify({
            name: "Paciente QA", goal: "bajar", startDate, createdAt: now.toISOString(),
            totalDays: 365, kcal: 1660, proteinG: 115, carbsG: 201, fatG: 44, waterMl: 2500,
          }));
          localStorage.setItem("copp.ai-disclosure." + id, JSON.stringify({
            version: "2026-11-21-health", acceptedAt: now.toISOString(),
          }));
        }, { id, lang, token });
        await page.route("**/api/**", (route) => {
          const { pathname } = new URL(route.request().url());
          const reply = (json) => route.fulfill({ json });
          if (pathname === "/api/auth/refresh") return reply({ accessToken: token, expiresIn: 86400 });
          if (pathname === "/api/auth/me") return reply({ id, firstName: "Paciente", lastName: "QA", roles: ["Patient"], permissions: [] });
          if (pathname === "/api/v1/me/patient-profile") {
            return reply({ patientId: id, firstName: "Paciente", lastName: "QA", documentNumber: "QA", phone: "+12025550101" });
          }
          if (pathname === "/api/v1/telemedicine/me") return reply({ patient: { id, organizationId: id }, clinics: [] });
          if (pathname === "/api/v1/me/legal-consents") return reply({ locale: lang, scopes: [] });
          if (/^\/api\/v1\/threads\/[^/]+\/messages$/.test(pathname)) {
            return reply({ threadId: pathname.split("/")[4], messageCount: 0, lastMessage: null, messages: [] });
          }
          return route.fulfill({ status: 204 });
        });

        await page.goto(origin, { waitUntil: "domcontentloaded" });
        await expect(page.locator("html")).toHaveAttribute("lang", lang);
        await page.locator(".wh-protocol").getByRole("button", { name: copy.close, exact: true }).click();
        await expect(page.getByRole("heading", { name: copy.close, level: 1 })).toBeVisible();
        const form = page.getByRole("form", { name: copy.form });
        await expect(form.getByRole("heading", { name: copy.form, level: 2 })).toBeVisible();
        const date = page.locator(".wc-scroll time");
        const iso = await date.getAttribute("datetime");
        assert.match(iso, /^\d{4}-\d{2}-\d{2}$/);
        const expected = await page.evaluate(({ iso, lang }) =>
          new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
            .format(new Date(iso + "T00:00:00Z")), { iso, lang });
        await expect(date).toHaveText(expected);

        const submit = form.getByRole("button", { name: copy.close, exact: true });
        await submit.click();
        const alert = form.getByRole("alert").filter({ hasText: copy.error });
        await expect(alert).toBeFocused();
        const exercise = form.getByRole("radiogroup", { name: copy.exercise });
        await expect(exercise).toHaveAttribute("aria-invalid", "true");
        await assertNoOverflow(page);

        for (const [index, name] of copy.fields.entries()) {
          await form.getByRole("spinbutton", { name }).fill(["75", "7.5", "4", "0"][index]);
        }
        const weight = form.getByRole("textbox", { name: copy.weight });
        const waist = form.getByRole("textbox", { name: copy.waist });
        await weight.fill(copy.weightValue);
        const focus = await form.locator('ion-input[name="weightKg"]').evaluate((node) => {
          const { outlineStyle, outlineWidth } = getComputedStyle(node);
          return outlineStyle === "solid" && parseFloat(outlineWidth) >= 2;
        });
        assert.ok(focus, "Contorno de foco del campo Peso");
        await page.keyboard.press("Tab");
        await expect(waist).toBeFocused();
        await waist.fill(copy.waistValue);
        const symptom = form.getByRole("checkbox", { name: copy.symptom });
        await symptom.focus();
        await page.keyboard.press("Space");
        await expect(symptom).toBeChecked();
        const exerciseYes = exercise.getByRole("radio", { name: copy.yes });
        await exerciseYes.focus();
        await page.keyboard.press("Space");
        await expect(exerciseYes).toBeChecked();
        for (const [name, target] of [[copy.weight, weight], [copy.symptom, symptom], [copy.yes, exerciseYes], [copy.close, submit]]) {
          const box = await target.boundingBox();
          assert.ok(box && box.width >= 44 && box.height >= 44, `${name}: ${JSON.stringify(box)}`);
        }
        await assertNoOverflow(page);
        await page.locator(".wc-scroll").evaluate((node) => { node.scrollTop = 0; });
        await page.screenshot({ path: join(output, `kan147-checkin-${lang}-${width}.png`) });
        await submit.click();
        await expect(page.getByRole("heading", { name: copy.closed, level: 1 })).toBeFocused();
        await expect(page.getByRole("heading", { name: copy.summary, level: 2 })).toBeVisible();
        await assertNoOverflow(page);
        await page.screenshot({ path: join(output, `kan147-checkin-summary-${lang}-${width}.png`) });

        const input = await page.evaluate(({ id, iso }) =>
          JSON.parse(localStorage.getItem("wellness.checkins.v1." + id))[iso].input, { id, iso });
        assert.ok(Math.abs(input.weightKg - copy.metric[0]) < 1e-10);
        assert.ok(Math.abs(input.waistCm - copy.metric[1]) < 1e-10);
        assert.deepEqual(errors, []);
        assert.deepEqual(consoleErrors, []);
        console.log(`PASS cierre ${lang} ${width}px`);
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
  if (browserPid) {
    assert.throws(() => process.kill(browserPid, 0), { code: "ESRCH" });
    console.log(`Chromium PID ${browserPid} cerrado`);
  }
}
