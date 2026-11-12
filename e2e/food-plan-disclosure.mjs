/** Captura/revisión reales en el navegador; Auth, plan y análisis HTTP sintéticos. */
import { chromium, expect } from "playwright/test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const origin = process.env.COP_E2E_APP_URL ?? "http://localhost:5188";
assert(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
const output = process.env.COP_E2E_OUTPUT;
assert(output?.startsWith("/tmp/"));
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const meals = ["Desayuno", "Almuerzo", "Merienda", "Cena"];
const targets = [500, 600, 250, 450];
const cases = process.env.COP_E2E_PHASE === "red" ? [{ lang: "es", width: 390, meal: 0 }]
  : [...meals.map((_, meal) => ({ lang: "es", width: 390, meal })), { lang: "es", width: 320, meal: 0 },
    { lang: "en", width: 390, meal: 0 }, { lang: "es", width: 390, meal: 0, partial: true },
    { lang: "es", width: 390, meal: 0, noPlan: true }, { lang: "es", width: 390, meal: 0, multiDay: true }];
const results = [];
for (const scenario of cases) {
  const { lang, width, meal } = scenario;
  const stamp = `${lang}-${width}-${meal}${scenario.partial ? "-partial" : scenario.noPlan ? "-no-plan" : scenario.multiDay ? "-days" : ""}`;
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage(); page.setDefaultTimeout(8000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await context.addInitScript(lang => localStorage.setItem("antares_lang", lang), lang);
  const id = randomUUID(), analysisId = randomUUID(), writes = [];
  const token = "x." + Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url") + ".x";
  const planMeals = meals.map((mealType, i) => ({ mealType, foods: "Avena y fruta", calories: targets[i], proteinG: 30, carbsG: 60, fatG: 15, fiberG: 6 }));
  const nutrition = { calories: 400, protein: 20, carbohydrates: 45, fat: 15, fiber: 3, sugar: null, sodium: null };
  await context.route("**/api/**", async route => {
    const request = route.request(), p = new URL(request.url()).pathname;
    const reply = json => route.fulfill({ json });
    if (p === "/api/auth/refresh") return reply({ accessToken: token, expiresIn: 3600 });
    if (p === "/api/auth/me") return reply({ id, firstName: "María", lastName: "Demo", roles: ["Patient"], permissions: [] });
    if (request.method() !== "GET") writes.push(p);
    if (p === "/api/v1/me/patient-profile") return reply({ patientId: id, firstName: "María", lastName: "Demo", documentNumber: "DEMO" });
    if (p === "/api/v1/program/me/snapshot") return reply({ enrollmentId: id,
      template: { id, code: "demo", name: "Programa de prueba", totalWeeks: 24, currentWeekNumber: 1, currentWeekStatus: "Active", currentWeekStartDateLocal: "2026-11-12", currentWeekEndDateLocal: "2026-11-18" },
      todayLocalDate: "2026-11-12", todayTasks: [{ taskCode: "nut", title: "Nutrición", points: 10, status: "Pending", content: { nutritionMeals: planMeals, nutritionIntakeLogs: [] } }],
      todayPoints: 0, todayBonusAvailable: false, todayPointsMax: 10, xp: { balance: 0, level: "1", nextLevelAt: 100 },
      streak: { current: 0, longest: 0, freezesRemaining: 0, multiplierActive: 1, multiplierEndsAt: null, multiplierRemainingHours: 0 }, nextMilestoneDays: 7, calendar: [] });
    if (p === "/api/v1/me/nutrition-plan") return scenario.noPlan ? route.fulfill({ status: 404, json: {} })
      : reply({ id, name: "Plan de prueba", ...(scenario.multiDay ? { days: [{ dayNumber: 1, meals: planMeals }, { dayNumber: 2, meals: [{ ...planMeals[0], calories: 650 }] }] } : { meals: planMeals }) });
    if (p === "/api/v1/me/nutrition-plan/status") return reply({ status: scenario.noPlan ? "no_plan" : "active" });
    if (p === "/api/v1/foodai/analyze") return reply({ analysisId, provider: "llm", status: "completed", foods: [{ name: "Avena con fruta", nameEn: "Oatmeal with fruit", confidence: 0.9,
      portion: { estimatedGrams: 300, minGrams: 250, maxGrams: 350, portionSize: "1 plato", confidence: 0.8, method: "demo" },
      nutrition, nutritionStatus: scenario.partial ? "unavailable" : "available", source: "demo" }], summary: nutrition,
      intake: { calories: 400, proteinG: 20, carbsG: 45, fatG: 15, fiberG: 3 } });
    if (p.endsWith("/program/notifications")) return reply({ items: [], unreadCount: 0, totalCount: 0 });
    return route.fulfill({ status: 404, json: {} });
  });
  try {
    await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.locator(".bnav").getByRole("button", { name: lang === "es" ? "Nutrición" : "Nutrition", exact: true }).click();
    await page.locator(".ntd-meal").nth(meal).getByRole("button", { name: lang === "es" ? "Foto IA" : "AI photo", exact: true }).click();
    await page.locator("input[data-gallery-input]").setInputFiles(new URL("../src/assets/nutrition/daily-breakfast.jpg", import.meta.url).pathname);
    await page.getByRole("button", { name: lang === "es" ? "Usar foto y analizar" : "Use photo and analyze", exact: true }).click();
    const comparison = page.locator(".food-plan-check");
    await expect(comparison).toBeVisible(); await comparison.scrollIntoViewIfNeeded();
    await comparison.screenshot({ path: path.join(output, `${stamp}-initial.png`), animations: "disabled" });
    const row = comparison.locator(".food-plan-summary");
    await expect(row).toBeVisible();
    await expect(row.getByRole("button")).toHaveAttribute("aria-expanded", "false");
    assert((await comparison.boundingBox()).height <= 72);
    if (scenario.partial || scenario.noPlan) await expect(row).not.toContainText(/400|0%/);
    else if (!scenario.multiDay) await expect(row).toContainText(`400 ${lang === "es" ? "de" : "of"} ${targets[meal]} kcal`);
    await row.click();
    await expect(comparison.locator("ion-accordion")).toHaveClass(/accordion-expanded/);
    if (scenario.multiDay) {
      await comparison.locator("ion-select").click();
      await page.getByRole("radio", { name: "Día 2", exact: true }).click();
      await expect(row).toContainText("400 de 650 kcal");
    }
    if (!scenario.partial && !scenario.noPlan) {
      await expect(comparison.locator(".food-plan-row")).toHaveCount(5);
      await expect(comparison.locator(".food-plan-target").first()).toContainText(String(scenario.multiDay ? 650 : targets[meal]));
      await expect(comparison).not.toContainText("Comparación estimada de porciones y macros. Estar por debajo no siempre es mejor");
    }
    await comparison.screenshot({ path: path.join(output, `${stamp}-detail.png`), animations: "disabled" });
    await row.click();
    await expect(comparison.locator("ion-accordion")).toHaveClass(/accordion-collapsed/);
    await comparison.screenshot({ path: path.join(output, `${stamp}-summary.png`), animations: "disabled" });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(writes, ["/api/v1/foodai/analyze"]);
    results.push({ ...scenario, passed: true });
  } catch (error) {
    results.push({ ...scenario, passed: false, error: error.message });
    await page.screenshot({ path: path.join(output, `${stamp}-failure.png`), animations: "disabled" });
  } finally { await context.close(); }
}
await browser.close();
await writeFile(path.join(output, "results.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
if (results.some(result => !result.passed)) process.exitCode = 1;
