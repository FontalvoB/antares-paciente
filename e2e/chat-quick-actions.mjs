/** UI y envío reales de la app; API sintética, sin pacientes ni llamadas al modelo. */
import { chromium, expect } from "playwright/test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const origin = process.env.COP_E2E_APP_URL ?? "http://localhost:5188";
assert(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
const output = process.env.COP_E2E_OUTPUT;
assert(output?.startsWith("/tmp/"), "Las evidencias deben quedar fuera del repositorio.");
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
const cases = process.env.COP_E2E_PHASE === "red"
  ? [{ lang: "es", width: 390 }]
  : ["es", "en"].flatMap(lang => [320, 390, 1280].map(width => ({ lang, width })));

for (const { lang, width } of cases) {
  const context = await browser.newContext({ viewport: { width, height: 950 } });
  const page = await context.newPage();
  page.setDefaultTimeout(6000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const accountId = randomUUID();
  const token = "x." + Buffer.from(JSON.stringify({ sub: accountId, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url") + ".x";
  const submitted = [];
  await context.addInitScript(lang => localStorage.setItem("antares_lang", lang), lang);
  await context.route("**/api/**", async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const reply = json => route.fulfill({ json });
    if (pathname === "/api/auth/refresh") return reply({ accessToken: token, expiresIn: 3600 });
    if (pathname === "/api/auth/me") return reply({ id: accountId, firstName: "María", lastName: "Demo", roles: ["Patient"], permissions: [] });
    if (pathname === "/api/v1/me/patient-profile") return reply({ patientId: accountId, firstName: "María", lastName: "Demo", documentNumber: "DEMO" });
    if (pathname.includes("/threads/") && pathname.endsWith("/messages")) return reply({ messages: [{ role: "bot", text: "Consulta [tu plan](https://erp.coppadresd.com/nutrition)." }], hasMore: false });
    if (pathname === "/api/v1/chat/stream") {
      const body = request.postDataJSON();
      submitted.push(body);
      const answer = `Respuesta de prueba ${submitted.length}`;
      return route.fulfill({ contentType: "text/event-stream", body: `data: ${JSON.stringify({ type: "token", content: answer })}\n\ndata: ${JSON.stringify({ type: "done", answer, thread_id: body.threadId, execution_id: randomUUID() })}\n\n` });
    }
    if (pathname.endsWith("/program/notifications")) return reply({ items: [], unreadCount: 0, totalCount: 0 });
    return route.fulfill({ status: 404, json: {} });
  });

  try {
    await page.goto(origin);
    await page.locator(".bnav").getByRole("button", { name: "Chat", exact: true }).click();
    const shortcuts = page.locator(".chat-quick-actions");
    const labels = lang === "es" ? ["Hábitos", "Progreso", "Ejercicios", "Nutrición"] : ["Habits", "Progress", "Exercises", "Nutrition"];
    await expect(shortcuts).toBeVisible();
    await page.screenshot({ path: path.join(output, `${lang}-${width}-initial.png`), animations: "disabled" });
    await expect(shortcuts.getByRole("button")).toHaveCount(4);
    for (const label of labels) await expect(shortcuts.getByRole("button", { name: label, exact: true })).toBeVisible();
    await expect(page.locator('.chat-list a[href*="/nutrition"]')).toHaveCount(0);
    const bounds = await shortcuts.getByRole("button").evaluateAll(buttons => buttons.map(button => {
      const rect = button.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }));
    assert(bounds.every(rect => rect.width >= 44 && rect.height >= 44));
    assert(bounds.every(rect => Math.abs(rect.y - bounds[0].y) < 2), "Los cuatro accesos deben ocupar la misma fila.");
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Sin desbordamiento horizontal.");
    const prompts = lang === "es"
      ? ["¿Cómo puedo organizar mis hábitos diarios?", "¿Cómo va mi progreso esta semana?", "¿Qué ejercicios me corresponden hoy según mi rutina?", "¿Qué debo comer hoy según mi plan?"]
      : ["How can I organize my daily habits?", "How is my progress this week?", "Which exercises are assigned to me today in my routine?", "What should I eat today according to my plan?"];
    for (let index = 0; index < labels.length; index++) {
      await shortcuts.getByRole("button", { name: labels[index], exact: true }).click();
      await expect.poll(() => submitted.length).toBe(index + 1);
      assert.equal(submitted[index].message, prompts[index]);
      assert.equal(submitted[index].language, lang);
      await expect(page.locator(".chat-list")).toContainText(`Respuesta de prueba ${index + 1}`);
      await expect(page.locator(".chat-list")).toContainText(prompts[index]);
    }
    // El nuevo acceso explícito no reactiva enlaces ocultos ni citas.
    await expect(shortcuts.getByRole("button", { name: lang === "es" ? "Agendar" : "Schedule", exact: true })).toHaveCount(0);
    results.push({ lang, width, passed: true, submitted: submitted.map(body => body.message) });
  } catch (error) {
    results.push({ lang, width, passed: false, error: error.message });
    await page.screenshot({ path: path.join(output, `${lang}-${width}-failure.png`), animations: "disabled" });
  } finally {
    await context.close();
  }
}
await browser.close();
await writeFile(path.join(output, "results.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
if (results.some(result => !result.passed)) process.exitCode = 1;
