/** Chromium con sesión y Food AI sintéticos. Ejecutar con Vite en 127.0.0.1:5175. */
import assert from "node:assert/strict";
import { chromium, expect } from "playwright/test";

const origin = process.env.COP_E2E_APP_URL ?? "http://127.0.0.1:5175";
const id = "11111111-1111-4111-8111-111111111111";
const token = "x." + Buffer.from(JSON.stringify({
  sub: id, exp: Math.floor(Date.now() / 1000) + 86400,
})).toString("base64url") + ".x";

const browser = await chromium.launch();
try {
  for (const width of [320, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 820 } });
    const page = await context.newPage();
    page.setDefaultTimeout(7000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript((patientId) => {
      const now = new Date();
      const date = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
      ].join("-");
      localStorage.setItem("antares_lang", "es");
      localStorage.setItem("wellness.plan.v1", JSON.stringify({
        name: "Paciente QA", goal: "bajar", startDate: date, createdAt: now.toISOString(),
        totalDays: 365, kcal: 1660, proteinG: 115, carbsG: 201, fatG: 44, waterMl: 2500,
        weightKg: 80, vegetarian: true, dairyFree: true,
      }));
      localStorage.setItem("wellness.protocol.v1", JSON.stringify({
        [date]: ["exercise", "vitals", "emotional"],
      }));
      localStorage.setItem("copp.ai-disclosure." + patientId, JSON.stringify({
        version: "2026-11-21-health", acceptedAt: now.toISOString(),
      }));
    }, id);
    await page.route("**/api/**", (route) => {
      const url = new URL(route.request().url());
      const reply = (json) => route.fulfill({ json });
      if (url.pathname === "/api/auth/refresh") return reply({ accessToken: token, expiresIn: 86400 });
      if (url.pathname === "/api/auth/me") return reply({ id, firstName: "Paciente", lastName: "QA", roles: ["Patient"], permissions: [] });
      if (url.pathname === "/api/v1/me/patient-profile") {
        return reply({ patientId: id, firstName: "Paciente", lastName: "QA", documentNumber: "QA", phone: "+12025550101" });
      }
      if (url.pathname === "/api/v1/me/context") {
        return reply({ patient: { id, organizationId: id }, clinics: [] });
      }
      if (url.pathname === "/api/v1/me/legal-consents") {
        return reply({ locale: "es", scopes: [{
          scope: "food", available: true, accepted: true, disclosureId: "qa", receiptId: "qa",
          documents: [{ locale: "es", versionId: "qa", content: "Consentimiento de prueba" }],
        }] });
      }
      if (url.pathname === "/api/v1/foodai/analyze") {
        return reply({
          analysisId: "test", status: "done", foods: [], summary: null,
          intake: { calories: 512, proteinG: 26, carbsG: 58, fatG: 20, fiberG: 6 },
        });
      }
      return route.fulfill({ status: 404, json: {} });
    });

    await page.goto(origin);
    await page.locator(".wh-quick").getByRole("button", { name: "Nutrición", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Dieta de hoy" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Lo comí", exact: true })).toHaveCount(4);
    await expect(page.getByText("Vegetariana", { exact: true })).toBeVisible();
    await expect(page.getByText("Sin lácteos", { exact: true })).toBeVisible();
    const simplified = page.getByRole("button", { name: "Modo simplificado" });
    await simplified.click();
    await expect(simplified).toHaveAttribute("aria-pressed", "true");
    await simplified.click();
    await expect(simplified).toHaveAttribute("aria-pressed", "false");
    await page.getByRole("button", { name: "+250 ml" }).click();
    await expect(page.getByText(/250 de 2[.,]?750 ml/)).toBeVisible();

    const breakfast = page.getByRole("region", { name: "Desayuno" });
    const ingredients = breakfast.locator("li");
    const before = await ingredients.allTextContents();
    const kcalGoal = await page.getByText(/^Meta diaria:/).innerText();
    await breakfast.getByRole("button", { name: "Cambiar plato" }).click();
    const after = await ingredients.allTextContents();
    assert.notDeepEqual(after, before);
    await expect(page.getByText(/^Meta diaria:/)).toHaveText(kcalGoal);

    await breakfast.getByRole("button", { name: "Foto de comida" }).click();
    await expect(page.getByRole("dialog", { name: "Foto de comida" })).toBeVisible();
    const modal = page.locator("ion-modal.wl-diet-modal");
    await expect(modal.getByRole("heading", { name: "Foto de comida · Desayuno" })).toBeVisible();
    await modal.locator("input[data-gallery-input]").setInputFiles({
      name: "meal.png",
      mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR2kAAAAASUVORK5CYII=", "base64"),
    });
    await modal.getByRole("button", { name: "Usar foto y analizar" }).click();
    const confirm = page.getByRole("button", { name: "Confirmar registro" });
    await expect(confirm).toBeEnabled();
    assert.deepEqual(await ingredients.allTextContents(), after);
    assert.equal(await page.locator(".wl-diet-log").innerText(), "0 de 4 comidas registradas");
    await page.getByRole("textbox", { name: "Energía (kcal)" }).fill("525");
    await confirm.click();
    await expect(breakfast.getByText("525 kcal", { exact: true })).toBeVisible();
    await expect(page.getByText("1 de 4 comidas registradas")).toBeVisible();
    await page.getByRole("region", { name: "Almuerzo" }).getByRole("button", { name: "Lo comí" }).click();
    await expect(page.getByText("2 de 4 comidas registradas")).toBeVisible();
    assert.equal(await page.evaluate(() => {
      const scroll = document.querySelector(".wp-scroll");
      return scroll.scrollWidth > scroll.clientWidth + 1;
    }), false);

    await page.getByRole("button", { name: "Volver al protocolo" }).click();
    await expect(page.getByText("4 de 5 pasos")).toBeVisible();
    await page.getByRole("button", { name: "Abrir mi cofre" }).click();
    await expect(page.getByText("¡Cofre abierto!")).toBeVisible();
    await page.getByRole("button", { name: "Seguir" }).click();
    await expect(page.getByText("5 de 5 pasos")).toBeVisible();
    await page.locator(".wp-card").filter({ has: page.getByRole("heading", { name: "2. Dieta" }) })
      .getByRole("button", { name: "Abrir módulo" }).click();
    await expect(page.getByText("2 de 4 comidas registradas")).toBeVisible();
    await expect(page.getByText(/250 de 2[.,]?750 ml/)).toBeVisible();
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`PASS dieta ${width}px`);
  }
} finally {
  await browser.close();
}

