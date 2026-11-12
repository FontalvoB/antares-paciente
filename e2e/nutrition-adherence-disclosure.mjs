/** App real con API sintética: verifica el resumen de adherencia sin escrituras clínicas. */
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
const cases = process.env.COP_E2E_PHASE === "red" ? [{ lang: "es", width: 390, current: 76 }]
  : [...["es", "en"].flatMap(lang => [320, 390, 1280].map(width => ({ lang, width, current: 76 }))),
    { lang: "es", width: 390, current: 0 }, { lang: "es", width: 390, current: null }, { lang: "es", width: 390, current: null, failed: true }];
const results = [];
for (const scenario of cases) {
  const { lang, width, current } = scenario;
  const id = randomUUID();
  const token = "x." + Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url") + ".x";
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await context.addInitScript(lang => localStorage.setItem("antares_lang", lang), lang);
  let failure = !!scenario.failed;
  const writes = [];
  const stamp = `${lang}-${width}-${current ?? "empty"}${scenario.failed ? "-error" : ""}`;
  await context.route("**/api/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const p = url.pathname;
    const reply = json => route.fulfill({ json });
    if (p === "/api/auth/refresh") return reply({ accessToken: token, expiresIn: 3600 });
    if (p === "/api/auth/me") return reply({ id, firstName: "María", lastName: "Demo", roles: ["Patient"], permissions: [] });
    if (request.method() !== "GET") writes.push(p);
    if (p === "/api/v1/me/patient-profile") return reply({ patientId: id, firstName: "María", lastName: "Demo", documentNumber: "DEMO" });
    if (p === "/api/v1/program/me/snapshot") return reply({ enrollmentId: id,
      template: { id, code: "demo", name: "Programa de prueba", totalWeeks: 24, currentWeekNumber: 1, currentWeekStatus: "Active", currentWeekStartDateLocal: "2026-11-12", currentWeekEndDateLocal: "2026-11-18" },
      todayLocalDate: "2026-11-12", todayTasks: [], todayPoints: 0, todayBonusAvailable: false, todayPointsMax: 0,
      xp: { balance: 0, level: "1", nextLevelAt: 100 }, streak: { current: 0, longest: 0, freezesRemaining: 0, multiplierActive: 1, multiplierEndsAt: null, multiplierRemainingHours: 0 }, nextMilestoneDays: 7, calendar: [] });
    if (p === "/api/v1/program/scores") return failure ? route.fulfill({ status: 503, json: {} })
      : reply({ health_score: { current: 76, trend: "stable", dimensions: { nutrition: scenario.failed ? 76 : current }, dimensions_previous: current == null && !scenario.failed ? null : { nutrition: 64 } } });
    if (p === "/api/v1/me/nutrition-plan/status") return reply({ status: "no_plan" });
    if (p.endsWith("/program/notifications")) return reply({ items: [], unreadCount: 0, totalCount: 0 });
    return route.fulfill({ status: 404, json: {} });
  });
  try {
    await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.locator(".bnav").getByRole("button", { name: lang === "es" ? "Nutrición" : "Nutrition", exact: true }).click();
    await page.locator('ion-segment-button[value="semana"]').click();
    await expect(page.locator(".ntr-view")).toBeVisible();
    await page.screenshot({ path: path.join(output, `${stamp}-initial.png`), animations: "disabled" });
    const row = page.locator(".ntr-adherence-summary");
    await expect(row).toBeVisible();
    await expect(row.getByRole("button")).toHaveAttribute("aria-expanded", "false");
    await expect(row).toContainText(current == null ? lang === "es" ? "Sin datos" : "No data" : `${current}%`);
    assert((await row.boundingBox()).height <= 72, "El resumen cerrado debe ocupar una línea compacta.");
    await row.click();
    await expect(row.getByRole("button")).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator('ion-accordion[value="weekly-adherence"]')).toHaveClass(/accordion-expanded/);
    const details = page.locator(".ntr-adherence-details");
    await expect(details).toBeInViewport();
    if (current != null) {
      await expect(details).toContainText(`${current}%`);
      await expect(details).toContainText("64%");
      await expect(details).not.toContainText(lang === "es" ? "Cada hábito cuenta" : "Every habit counts");
    } else {
      await expect(details).toContainText(lang === "es" ? "Sin datos esta semana" : "No data this week");
      await expect(details).not.toContainText("0%");
      if (scenario.failed) {
        failure = false;
        await details.getByRole("button", { name: "Reintentar", exact: true }).click();
        await expect(row).toContainText("76%");
      }
    }
    await page.screenshot({ path: path.join(output, `${stamp}-expanded.png`), animations: "disabled" });
    await page.locator(".ntr-adherence").screenshot({ path: path.join(output, `${stamp}-detail.png`), animations: "disabled" });
    await row.click();
    await expect(row.getByRole("button")).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator('ion-accordion[value="weekly-adherence"]')).toHaveClass(/accordion-collapsed/);
    await page.locator(".ntr-adherence").screenshot({ path: path.join(output, `${stamp}-summary.png`), animations: "disabled" });
    await page.screenshot({ path: path.join(output, `${stamp}-collapsed.png`), animations: "disabled" });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(writes, []);
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
