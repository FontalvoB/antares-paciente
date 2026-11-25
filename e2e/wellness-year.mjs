/** Chromium con sesión y cierres sintéticos. Ejecutar con Vite en 127.0.0.1:5183. */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium, expect } from "playwright/test";

const origin = "http://127.0.0.1:5183";
const evidence = process.env.COP_E2E_SCREENSHOTS
  ?? "C:/Users/Luis/Documents/CoppAddresd/Repos/.ai/operations/2026-11-25-ola4/kan140";
const fixedTime = new Date("2026-11-25T17:00:00Z");
const id = "11111111-1111-4111-8111-111111111111";
const token = "x." + Buffer.from(JSON.stringify({
  sub: id, exp: Math.floor(fixedTime.getTime() / 1000) + 86400,
})).toString("base64url") + ".x";

await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ channel: process.env.COP_E2E_BROWSER_CHANNEL });
const english = {
  "Abrir Año 365": "Open Year 365", "Año 365": "Year 365",
  "Resumen mensual": "Monthly summary", "Curvas de peso y cintura": "Weight and waist charts",
  "Curva de Peso": "Weight chart", "Curva de Cintura": "Waist chart", "Calendario del plan": "Plan calendar",
  "octubre de 2026": "October 2026", "enero de 2027": "January 2027", "noviembre de 2026": "November 2026",
  "Sin mediciones en este período.": "No measurements in this period.",
  "Aún no hay cierres registrados en este mes.": "No daily check-ins have been recorded this month yet.",
  "Ver calendario": "View calendar", "2 días": "2 days", "Volver a Inicio": "Return to Home",
  "Perfil": "Profile",
};
try {
  for (const [width, lang] of [320, 390, 768].flatMap((width) => [[width, "es"], [width, "en"]])) {
    const label = (spanish) => lang === "en" ? english[spanish] : spanish;
    const context = await browser.newContext({
      viewport: { width, height: 820 },
      timezoneId: "America/Bogota",
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    await page.clock.setFixedTime(fixedTime);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.addInitScript(({ patientId, units, language }) => {
      const now = new Date().toISOString();
      const plan = {
        name: "Paciente QA", goal: "bajar", startDate: "2026-08-01", createdAt: now,
        totalDays: 365, kcal: 1660, proteinG: 115, carbsG: 201, fatG: 44, waterMl: 2500,
        weightKg: 80, version: 2,
      };
      localStorage.setItem("antares_lang", language);
      if (units) localStorage.setItem("wellness.vitals.units.v1." + patientId, JSON.stringify({ weight: "lb" }));
      localStorage.setItem("wellness.plan.v1", JSON.stringify(plan));
      localStorage.setItem("wellness.plan.versions.v1", JSON.stringify([
        { version: 1, changedAt: "2026-11-22T16:00:00Z", snapshot: { ...plan, version: 1 } },
      ]));
      const entries = [
        ["2026-09-15", 100, 84, 93],
        ["2026-10-31", 75, 83, 91],
        ["2026-11-02", 50, 81, 89],
        ["2026-11-23", 60, 79, null],
        ["2026-11-24", 100, 78, 85],
      ];
      localStorage.setItem("wellness.checkins.v1." + patientId, JSON.stringify(Object.fromEntries(
        entries.map(([date, adherence, weightKg, waistCm]) => [date, {
          date, idempotencyKey: "qa:" + date, status: "synced",
          input: { adherence, weightKg, waistCm, sleepHours: 7, energy: 4, pain: 0, symptoms: [], exercised: true },
        }]),
      )));
      localStorage.setItem("copp.ai-disclosure." + patientId, JSON.stringify({
        version: "2026-11-21-health", acceptedAt: now,
      }));
    }, { patientId: id, units: width === 390 ? "us" : null, language: lang });
    await page.route("**/api/**", (route) => {
      const { pathname } = new URL(route.request().url());
      const reply = (json) => route.fulfill({ json });
      if (pathname === "/api/auth/refresh") return reply({ accessToken: token, expiresIn: 86400 });
      if (pathname === "/api/auth/me") return reply({ id, firstName: "Paciente", lastName: "QA", roles: ["Patient"], permissions: [] });
      if (pathname === "/api/v1/me/patient-profile") {
        return reply({ patientId: id, firstName: "Paciente", lastName: "QA", documentNumber: "QA", phone: "+12025550101" });
      }
      if (pathname === "/api/v1/me/context") return reply({ patient: { id, organizationId: id }, clinics: [] });
      return reply({});
    });

    await page.goto(origin, { waitUntil: "commit" });
    await page.getByRole("button", { name: label("Abrir Año 365") }).click();
    const heading = page.getByRole("heading", { name: label("Año 365"), exact: true });
    await expect(heading).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", lang);

    const summary = page.getByRole("region", { name: label("Resumen mensual") });
    await expect(summary.getByText(/^70\s*%$/)).toBeVisible();
    await expect(summary.getByText(label("2 días"))).toBeVisible();
    await expect(summary.getByText(width === 390 ? /-6[,.]6\s*lb/ : /-3\s*kg/)).toBeVisible();
    await expect(summary.getByText(width === 390 ? /-1[,.]6\s*(in|pulg)/ : /-4\s*cm/)).toBeVisible();

    const curves = page.getByRole("region", { name: label("Curvas de peso y cintura") });
    const weight = curves.getByRole("img", { name: label("Curva de Peso") });
    const waist = curves.getByRole("img", { name: label("Curva de Cintura") });
    await expect(weight).toBeVisible();
    await expect(waist).toBeVisible();
    await expect(weight).toHaveAccessibleDescription(/(?:Mediciones|Measurements): 4/);
    await expect(weight.locator(".wy-marker circle")).toHaveCount(1);
    await expect(weight.locator(".wy-area")).toHaveCount(1);
    await expect(curves.getByText(/^(Cambio de plan|Plan change)/)).toBeVisible();

    for (const [period, count] of [["7", 2], ["90", 5], ["month", 3], ["30", 4]]) {
      await curves.locator(`ion-segment-button[value="${period}"]`).click();
      await expect(weight.locator(".wy-point")).toHaveCount(count);
    }

    const select = summary.locator("ion-select");
    async function selectMonth(label) {
      const popover = page.locator("ion-popover:not(.overlay-hidden)");
      await select.click();
      await popover.getByText(label, { exact: true }).click();
      await expect(popover).toHaveCount(0);
    }
    await selectMonth(label("octubre de 2026"));
    await expect(weight.locator(".wy-point")).toHaveCount(1);
    await expect(summary.getByText(/^75\s*%$/)).toBeVisible();
    await selectMonth(label("enero de 2027"));
    await expect(summary.getByText(label("Aún no hay cierres registrados en este mes."))).toBeVisible();
    await expect(curves.getByText(label("Sin mediciones en este período."))).toHaveCount(2);
    await selectMonth(label("noviembre de 2026"));
    await expect(weight.locator(".wy-point")).toHaveCount(3);

    const grid = page.getByRole("grid", { name: label("Calendario del plan") });
    await expect(grid.locator("[data-plan-day]")).toHaveCount(365);
    const complete = grid.getByRole("gridcell", { name: /24 de noviembre.*Completado|November 24.*Complete/ });
    await expect(complete).toHaveCount(1);
    await expect(grid.getByRole("gridcell", { name: /23 de noviembre.*Parcial|November 23.*Partial/ })).toHaveCount(1);
    const today = grid.getByRole("gridcell", { name: /25 de noviembre.*Sin datos|November 25.*No data/ });
    await expect(today).toHaveCount(1);
    await expect(grid.getByRole("gridcell", { name: /26 de noviembre.*Futuro|November 26.*Upcoming/ })).toHaveCount(1);

    const layout = await page.evaluate(async () => {
      await document.fonts.ready;
      const scroll = document.querySelector(".wy-scroll");
      const html = document.documentElement;
      const text = [...scroll.querySelectorAll("h1, h2, dt, dd, p, figcaption, time, .wy-day, .wy-month-title, .wy-legend li, .wy-plot-max, .wy-plot-min")];
      const selectText = scroll.querySelector("ion-select").shadowRoot?.querySelector('[part="text"]');
      if (selectText) text.push(selectText);
      const luminance = (rgb) => rgb.match(/\d+/g).slice(0, 3).map((channel) => Number(channel) / 255)
        .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
        .reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0);
      return {
        overflow: scroll.scrollWidth > scroll.clientWidth + 1 || html.scrollWidth > html.clientWidth + 1,
        clippedText: text.filter((element) => element.scrollWidth > element.clientWidth + 1 ||
          element.scrollHeight > element.clientHeight + 1).map((element) => element.textContent),
        dayContrast: ["complete", "partial", "missing", "future"].map((status) => {
          const style = getComputedStyle(scroll.querySelector(`.wy-day[data-status="${status}"]`));
          const contrast = [luminance(style.color), luminance(style.backgroundColor)].sort((a, b) => b - a);
          return (contrast[0] + 0.05) / (contrast[1] + 0.05);
        }),
        filterHeights: [...scroll.querySelectorAll("ion-segment-button, ion-select")].map(
          (filter) => (filter.shadowRoot?.querySelector("button") ?? filter).getBoundingClientRect().height,
        ),
      };
    });
    assert.equal(layout.overflow, false);
    assert.deepEqual(layout.clippedText, []);
    assert(layout.dayContrast.every((ratio) => ratio >= 4.5), JSON.stringify(layout));
    assert.equal(layout.filterHeights.length, 5);
    assert(layout.filterHeights.every((height) => height >= 44), JSON.stringify(layout));

    await heading.focus();
    await page.locator(".wy-scroll").evaluate((scroll) => scroll.scrollTo(0, 0));
    await page.screenshot({ path: join(evidence, `kan140-year-${lang}-${width}.png`) });
    await page.getByRole("button", { name: label("Ver calendario") }).press("Enter");
    await expect(today).toBeFocused();
    await complete.focus();
    await page.keyboard.press("ArrowRight");
    await expect(today).toBeFocused();
    await page.screenshot({ path: join(evidence, `kan140-calendar-${lang}-${width}.png`) });

    await page.getByRole("button", { name: label("Volver a Inicio") }).click();
    await expect(page.getByRole("button", { name: label("Abrir Año 365") })).toBeVisible();
    await page.getByRole("button", { name: label("Perfil"), exact: true }).click();
    await page.getByRole("button", { name: new RegExp(label("Año 365")) }).click();
    await expect(heading).toBeVisible();
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`PASS Año 365 ${width}px ${lang.toUpperCase()}`);
  }
} finally {
  await browser.close();
}
