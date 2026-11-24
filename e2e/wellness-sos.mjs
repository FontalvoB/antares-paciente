/**
 * KAN-137 · SOS global. Chromium con sesión sintética; ejecutar con Vite en 127.0.0.1:5178.
 * Comprueba a 390 y 320 px: SOS en la barra durante la sesión de ejercicio, acceso flotante
 * por encima de un modal Ionic, cuenta regresiva accesible, cancelar sin aviso y llamada a los 5 s.
 */
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, expect } from "playwright/test";

const origin = process.env.COP_E2E_APP_URL ?? "http://127.0.0.1:5178";
const shots = process.env.COP_E2E_SHOTS ?? join(tmpdir(), "kan137-sos");
mkdirSync(shots, { recursive: true });
const id = "11111111-1111-4111-8111-111111111111";
const token = "x." + Buffer.from(JSON.stringify({
  sub: id, exp: Math.floor(Date.now() / 1000) + 86400,
})).toString("base64url") + ".x";

/** El elemento visible en el centro del localizador es él mismo (o un descendiente): nada lo tapa. */
async function assertOnTop(page, locator, label) {
  const box = await locator.boundingBox();
  assert.ok(box, `${label}: sin caja`);
  const onTop = await locator.evaluate((element, point) => {
    const hit = document.elementFromPoint(point.x, point.y);
    // Ionic pasa el aria-label al <button> interno: se compara también con su host.
    const root = element.getRootNode();
    const target = root instanceof ShadowRoot ? root.host : element;
    if (hit && (target === hit || target.contains(hit) || target.shadowRoot?.contains(hit))) return true;
    return hit ? `${hit.tagName.toLowerCase()}.${String(hit.className).slice(0, 80)}` : "nada";
  }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  assert.equal(onTop, true, `${label}: tapado por ${onTop}`);
}

const audit = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("wellness.sos.audit.v1") ?? "[]"));
const notices = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("wellness.sos.notices.v1") ?? "[]"));

const browser = await chromium.launch();
try {
  for (const width of [390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 820 } });
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript((patientId) => {
      const now = new Date();
      const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
      localStorage.setItem("antares_lang", "es");
      localStorage.setItem("wellness.plan.v1", JSON.stringify({
        name: "Paciente QA", goal: "bajar", startDate: date, createdAt: now.toISOString(),
        totalDays: 365, kcal: 1660, proteinG: 115, carbsG: 201, fatG: 44, waterMl: 2500,
        weightKg: 80, vegetarian: false, dairyFree: false,
      }));
      localStorage.setItem("copp.ai-disclosure." + patientId, JSON.stringify({ version: "2026-11-21-health", acceptedAt: now.toISOString() }));
    }, id);
    await page.route("**/api/**", (route) => {
      const url = new URL(route.request().url());
      const reply = (json) => route.fulfill({ json });
      if (url.pathname === "/api/auth/refresh") return reply({ accessToken: token, expiresIn: 86400 });
      if (url.pathname === "/api/auth/me") return reply({ id, firstName: "Paciente", lastName: "QA", roles: ["Patient"], permissions: [] });
      if (url.pathname === "/api/v1/me/patient-profile") {
        return reply({
          patientId: id, firstName: "Paciente", lastName: "QA", documentNumber: "QA", phone: "+12025550101",
          emergencyName: "Contacto QA", emergencyRelationship: "Familiar", emergencyPhone: "+12025550102",
        });
      }
      if (url.pathname === "/api/v1/me/context") return reply({ patient: { id, organizationId: id }, clinics: [] });
      if (url.pathname.startsWith("/api/v1/sos")) throw new Error(`El SOS local no debe llamar al backend: ${url.pathname}`);
      return route.fulfill({ status: 404, json: {} });
    });

    await page.goto(origin);
    // 1) Sesión de ejercicio: el SOS fijo de la barra sigue visible y sin tapar.
    await page.locator(".wh-quick").getByRole("button", { name: "Ejercicio", exact: true }).click();
    await page.getByRole("button", { name: "Empezar sesión" }).click();
    await expect(page.getByText("Ejercicio 1 de 4")).toBeVisible();
    const navSos = page.locator(".bnav .ni-center");
    await expect(navSos).toHaveAttribute("aria-label", "Abrir SOS de emergencia");
    await assertOnTop(page, navSos, "SOS de la barra en la sesión");
    await expect(page.locator(".sos-quick-access")).toHaveCount(0);
    await page.screenshot({ path: join(shots, `sos-session-${width}.png`) });

    // 2) Un toque abre la cuenta regresiva por encima de la sesión. Cancelar no avisa.
    await navSos.click();
    const alert = page.locator(".sos-countdown [role='alert']");
    await expect(alert).toContainText("Llamaremos a emergencias en");
    await expect(alert).toHaveAttribute("aria-live", "assertive");
    const cancel = page.getByRole("button", { name: "Cancelar SOS" }).last();
    await assertOnTop(page, cancel, "Cancelar en la cuenta regresiva");
    await assertOnTop(page, page.locator(".sos-countdown .sos-act-911"), "Llamar a emergencias");
    await page.waitForTimeout(500); // fin del fundido de entrada
    await page.screenshot({ path: join(shots, `sos-countdown-${width}.png`) });
    await cancel.click();
    await expect(page.locator(".overlay-panic")).toHaveCount(0);
    await expect(page.getByText("Ejercicio 1 de 4")).toBeVisible();
    assert.deepEqual((await audit(page)).map((entry) => entry.result), ["cancelled"]);
    assert.equal((await audit(page))[0].screen, "wellness-exercise");
    assert.deepEqual(await notices(page), []);

    // 3) Modal abierto (salir de la sesión → protocolo → dieta → foto): el acceso flotante queda encima.
    await page.getByRole("button", { name: "Salir de la sesión" }).click();
    await page.locator(".wh-quick").getByRole("button", { name: "Nutrición", exact: true }).click().catch(async () => {
      await page.getByRole("button", { name: "Inicio" }).click();
      await page.locator(".wh-quick").getByRole("button", { name: "Nutrición", exact: true }).click();
    });
    await expect(page.getByRole("heading", { name: "Dieta de hoy" })).toBeVisible();
    await page.getByRole("region", { name: "Desayuno" }).getByRole("button", { name: "Foto de comida" }).click();
    await expect(page.locator("ion-modal.wl-diet-modal")).toBeVisible();
    const quick = page.locator(".sos-layer .sos-quick-access");
    await expect(quick).toBeVisible();
    await assertOnTop(page, quick, "SOS flotante sobre el modal");
    await page.screenshot({ path: join(shots, `sos-modal-${width}.png`) });

    // 4) Sin cancelar: a los 5 s se abre la llamada al 911 y se registra el aviso local.
    await quick.click();
    await expect(page.locator(".sos-countdown")).toBeVisible();
    await assertOnTop(page, page.getByRole("button", { name: "Cancelar SOS" }).last(), "Cuenta regresiva sobre el modal");
    await expect(page.locator(".sos-countdown")).toHaveCount(0, { timeout: 8000 });
    await expect(page.getByRole("tab", { name: "Mi equipo" })).toBeVisible();
    const results = (await audit(page)).map((entry) => entry.result);
    assert.deepEqual(results, ["cancelled", "called_911"]);
    assert.equal((await notices(page)).length, 1);
    assert.equal((await notices(page))[0].contacts, 1);
    assert.equal(await page.evaluate(() => document.body.innerText.includes("en camino")), false);
    await page.waitForTimeout(500); // fin del fundido de entrada
    await page.screenshot({ path: join(shots, `sos-after-${width}.png`) });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false);

    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log(`OK wellness-sos (capturas en ${shots})`);
} finally {
  await browser.close();
}
