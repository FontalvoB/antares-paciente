import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium, expect } from "playwright/test";

const origin = "http://127.0.0.1:5184";
const output = ".ai/operations/2026-11-25-kan157";
const id = "11111111-1111-4111-8111-111111111111";
const token = "x." + Buffer.from(JSON.stringify({
  sub: id,
  exp: Math.floor(Date.now() / 1000) + 3600,
})).toString("base64url") + ".x";

await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  for (const width of [390, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: 820 },
      reducedMotion: "reduce",
      acceptDownloads: true,
    });
    try {
      await context.addInitScript(() => {
        localStorage.setItem("antares_lang", "es");
        localStorage.setItem("wellness.qa.v1", JSON.stringify({ weightKg: 75 }));
      });
      await context.route("**/api/**", (route) => {
        const reply = (json) => route.fulfill({ json });
        switch (new URL(route.request().url()).pathname) {
          case "/api/auth/refresh": return reply({ accessToken: token, expiresIn: 3600 });
          case "/api/auth/me": return reply({ id, firstName: "Paciente", lastName: "QA", roles: ["Patient"], permissions: [] });
          case "/api/v1/me/patient-profile": return reply({ patientId: id, firstName: "Paciente", lastName: "QA", documentNumber: "QA" });
          case "/api/v1/me/context": return reply({ patient: { id, organizationId: id }, clinics: [] });
          default: return route.fulfill({ status: 404, json: {} });
        }
      });
      const page = await context.newPage();
      page.setDefaultTimeout(8000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(origin);
      const nav = page.getByRole("navigation", { name: "Navegación principal" });
      await expect(nav, `Home load errors: ${errors.join(", ")}`).toBeVisible();
      await nav.getByRole("button", { name: "Perfil", exact: true }).click();
      await page.getByRole("button", { name: "Privacidad y datos", exact: true }).click();
      const title = page.getByRole("heading", { name: "Privacidad y datos" });
      await expect(title).toBeFocused();
      const scroller = page.locator(".wellness-privacy-scroll");
      assert.equal(await scroller.evaluate((node) => node.scrollWidth > node.clientWidth), false);
      await page.screenshot({ path: join(output, `privacy-${width}.png`) });

      const sensitive = page.getByRole("checkbox", { name: /Acepto el uso de mis datos sensibles/ });
      await expect(sensitive).not.toBeChecked();
      await sensitive.focus();
      await page.keyboard.press("Space");
      await expect(sensitive).toBeChecked();
      await expect(page.getByRole("checkbox", { name: /Acepto conectar Apple Health/ })).not.toBeChecked();
      await expect(page.locator("time").filter({ hasText: "Aceptado el" })).toBeVisible();
      assert.ok((await sensitive.boundingBox()).height >= 44);
      await page.screenshot({ path: join(output, `privacy-consent-${width}.png`) });

      const pending = page.waitForEvent("download");
      await page.getByRole("button", { name: "Exportar mis datos" }).click();
      const download = await pending;
      assert.match(download.suggestedFilename(), /^wellness-.*\.json$/);
      const json = JSON.parse(await readFile(await download.path(), "utf8"));
      assert.equal(json.metadata.version, 1);
      assert.deepEqual(json.data["wellness.qa.v1"], { weightKg: 75 });
      assert.equal(json.privacyAudit[0].scope, "sensitive-data");
      assert.equal(json.privacyAudit[0].actor, id);
      await expect(page.getByRole("status")).toHaveText("Tu archivo JSON está listo.");
      await page.screenshot({ path: join(output, `privacy-export-${width}.png`) });

      const deleteButton = page.getByRole("button", { name: "Borrar mis datos" });
      await deleteButton.click();
      const alert = page.getByRole("alertdialog", { name: "¿Borrar los datos de bienestar?" });
      await expect(alert.getByRole("button", { name: "Cancelar" })).toBeFocused();
      await alert.getByRole("button", { name: "Cancelar" }).click();
      await expect(alert).toHaveCount(0);
      await expect(deleteButton).toBeFocused();
      assert.equal(await page.evaluate(() => localStorage.getItem("wellness.qa.v1")), '{"weightKg":75}');
      await deleteButton.click();
      await alert.getByRole("button", { name: "Borrar datos", exact: true }).click();
      await expect(page.getByRole("status")).toContainText("Tu sesión sigue abierta.");
      assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("wellness."))), []);
      await expect(sensitive).not.toBeChecked();
      await page.getByRole("button", { name: "Volver al perfil" }).click();
      await expect(page.getByRole("button", { name: "Privacidad y datos" })).toBeVisible();
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px Perfil → Privacidad → consentimiento por teclado → JSON → cancelar/borrar → Perfil`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
