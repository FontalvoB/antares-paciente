/**
 * KAN-147 · i18n y accesibilidad del bienestar sobre el Home rediseñado (KAN-121), en Chromium
 * con Vite en 127.0.0.1:5181. Recorrido por idioma (es/en) y viewport (320/390/768):
 * Inicio → Ejercicio → protocolo → Inicio → Nutrición → protocolo → Inicio → anillo del día →
 * plan de bienestar → etapa «Bienestar» → cierre del día (formulario, errores, unidades, resumen).
 * Canal del navegador: KAN147_CHROMIUM_CHANNEL o COP_E2E_BROWSER_CHANNEL (p. ej. "chrome").
 */
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
    ring: "Ver mi plan de bienestar", tasks: "Actividades del día", exerciseTask: "Ejercicio",
    dietTask: "Nutrición", backProtocol: "Volver al protocolo", backHome: "Volver al inicio",
    backPlanHome: "Volver a Inicio", diet: "Dieta de hoy", plan: "Tu Plan de Bienestar",
    wellnessStage: "Bienestar",
    close: "Cerrar el día", closed: "Día cerrado", form: "Registro de hoy",
    fields: ["Adherencia (%)", "Horas de sueño", "Energía (1–5)", "Dolor (0–10)"],
    weight: "Peso (kg, opcional)", waist: "Cintura (cm, opcional)",
    weightValue: "72,5", waistValue: "80,5", metric: [72.5, 80.5],
    symptom: "Náuseas", exercise: "¿Hiciste ejercicio hoy?", yes: "Sí",
    error: "Revisa los valores e indica si hiciste ejercicio.", summary: "Tu plan para mañana",
  },
  en: {
    ring: "View my wellness plan", tasks: "Daily activities", exerciseTask: "Exercise",
    dietTask: "Nutrition", backProtocol: "Back to protocol", backHome: "Back to home",
    backPlanHome: "Return to Home", diet: "Today’s diet", plan: "Your Wellness Plan",
    wellnessStage: "Wellness",
    close: "Close the day", closed: "Day closed", form: "Today's check-in",
    fields: ["Adherence (%)", "Hours of sleep", "Energy (1–5)", "Pain (0–10)"],
    weight: "Weight (lb, optional)", waist: "Waist (in, optional)",
    weightValue: "160", waistValue: "32", metric: [72.5747792, 81.28],
    symptom: "Nausea", exercise: "Did you exercise today?", yes: "Yes",
    error: "Check your entries and indicate whether you exercised.", summary: "Your plan for tomorrow",
  },
};

/** Pantallas actuales: Home/plan (.wh-scroll), protocolo (.wp-scroll), ejercicio (.wx-scroll), cierre (.wc-scroll). */
const SCROLLS = ".wh-scroll, .wp-scroll, .wx-scroll, .wc-scroll";

async function assertNoOverflow(page) {
  const overflow = await page.evaluate((scrolls) => {
    const labels = document.querySelectorAll(`:is(${scrolls}) :is(h1,h2,.label-text-wrapper)`);
    return [document.documentElement, document.querySelector(".app-shell"), ...document.querySelectorAll(scrolls), ...labels]
      .filter((node) => node && node.clientWidth && node.scrollWidth > node.clientWidth + 1)
      .map((node) => node.className);
  }, SCROLLS);
  assert.deepEqual(overflow, []);
}

/** Área táctil mínima de 44×44 px (WCAG 2.5.8 / iOS HIG). */
async function assertTarget(name, locator) {
  const box = await locator.boundingBox();
  assert.ok(box && box.width >= 44 && box.height >= 44, `${name}: ${JSON.stringify(box)}`);
}

/**
 * Foco visible por teclado: contorno sólido ≥2 px en el control enfocado o en su host Ionic.
 * En IonButton el foco cae en el <button> nativo del shadow DOM, que es quien pinta el contorno.
 */
async function assertFocusRing(page, name, locator, shot) {
  await locator.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(locator).toBeFocused();
  const visible = await locator.evaluate((node) => {
    const root = node.getRootNode();
    const host = root instanceof ShadowRoot ? root.host : node;
    return [node, host].some((element) => {
      const { outlineStyle, outlineWidth } = getComputedStyle(element);
      return outlineStyle === "solid" && parseFloat(outlineWidth) >= 2;
    });
  });
  assert.ok(visible, `Contorno de foco: ${name}`);
  await locator.screenshot({ path: join(output, shot) });
}

await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: process.env.KAN147_CHROMIUM_CHANNEL ?? process.env.COP_E2E_BROWSER_CHANNEL,
});
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
          // Consentimiento de datos sensibles (KAN-121): ejercicio y cierre del día van tras SensitiveDataScreen.
          // Debe coincidir con WELLNESS_CONSENT_VERSIONS["sensitive-data"] (privacy-consent-store.ts).
          const at = now.toISOString();
          localStorage.setItem(`copp.wellness-privacy.audit.v1.${at}.00000000.e2e`, JSON.stringify({
            action: "accepted", actor: id, scope: "sensitive-data", version: "2026-11-25-draft.1", acceptedAt: at, at,
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

        // Inicio rediseñado: anillo del día y lista de actividades (wh-task).
        const home = async () => {
          const ring = page.locator(".wh-ring-button").getByRole("button", { name: copy.ring, exact: true });
          await expect(ring).toBeVisible();
          return ring;
        };
        const ring = await home();
        const tasks = page.getByRole("region", { name: copy.tasks });
        const exerciseTask = tasks.locator(".wh-task").filter({ hasText: copy.exerciseTask }).getByRole("button");
        const dietTask = tasks.locator(".wh-task").filter({ hasText: copy.dietTask }).getByRole("button");
        await assertTarget(copy.ring, ring);
        await assertTarget(copy.exerciseTask, exerciseTask);
        await assertTarget(copy.dietTask, dietTask);
        await assertFocusRing(page, copy.exerciseTask, exerciseTask, `kan147-focus-task-${lang}-${width}.png`);
        await assertNoOverflow(page);
        await page.screenshot({ path: join(output, `kan147-home-${lang}-${width}.png`) });

        // Ejercicio y dieta: se entra desde la lista del Inicio y se sale por el protocolo.
        const backToHome = async () => {
          const backProtocol = page.getByRole("button", { name: copy.backProtocol, exact: true });
          await assertTarget(copy.backProtocol, backProtocol);
          await backProtocol.click();
          const backHome = page.getByRole("button", { name: copy.backHome, exact: true });
          await assertTarget(copy.backHome, backHome);
          await backHome.click();
          await home();
        };
        await exerciseTask.click();
        await expect(page.locator(".wx-scroll").getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page.locator(".wx-eyebrow")).toHaveText(copy.exerciseTask);
        await assertNoOverflow(page);
        await page.screenshot({ path: join(output, `kan147-exercise-${lang}-${width}.png`) });
        await backToHome();

        await dietTask.click();
        await expect(page.getByRole("heading", { name: copy.diet, level: 1 })).toBeVisible();
        await assertNoOverflow(page);
        await page.screenshot({ path: join(output, `kan147-diet-${lang}-${width}.png`) });
        await backToHome();

        // Cierre del día: anillo → plan de bienestar → etapa «Bienestar».
        await (await home()).click();
        await expect(page.getByRole("heading", { name: copy.plan, level: 2 })).toBeVisible();
        await assertTarget(copy.backPlanHome, page.getByRole("button", { name: copy.backPlanHome, exact: true }));
        const stage = page.locator(".wh-plan-stages").getByRole("button", { name: copy.wellnessStage, exact: true });
        await assertTarget(copy.wellnessStage, stage);
        await assertNoOverflow(page);
        await stage.click();
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
          await assertTarget(name, target);
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
        console.log(`PASS inicio/ejercicio/dieta/plan/cierre ${lang} ${width}px`);
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
