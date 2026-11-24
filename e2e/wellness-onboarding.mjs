/**
 * KAN-136 — onboarding de 5 pasos + objetivo de 8 pasos.
 *
 * Recorre la app real en modo navegador con la API sintética (mismo patrón que
 * `onboarding-emergency-contacts.mjs`): login/activación → onboarding nuevo →
 * plan listo. Captura evidencia en ES a 390 px y comprueba 320 px sin overflow.
 */
import { chromium, expect } from "playwright/test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const out = process.env.COP_E2E_OUTPUT;
assert(out, "COP_E2E_OUTPUT is required");

const browser = await chromium.launch();
const results = [];

const token =
  "x." +
  Buffer.from(
    JSON.stringify({
      sub: "11111111-1111-4111-8111-111111111111",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString("base64url") +
  ".x";

async function mockApi(context) {
  let verified = false;
  await context.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname;
    const reply = (json) => route.fulfill({ json });
    if (p === "/api/auth/refresh") {
      return verified
        ? reply({ accessToken: token, expiresIn: 3600 })
        : route.fulfill({ status: 401, json: {} });
    }
    if (p === "/api/auth/id-lookup") {
      return reply({
        patientId: "11111111-1111-4111-8111-111111111111",
        firstName: "Paciente",
        lastName: "QA",
        documentNumber: "QA",
        contacts: [
          { id: "qa-contact", type: "Email", label: "qa@example.invalid" },
        ],
      });
    }
    if (p === "/api/auth/send-otp") return reply({ expiresInSeconds: 300 });
    if (p === "/api/auth/verify-otp") {
      verified = true;
      return reply({
        accessToken: token,
        tokenType: "Bearer",
        expiresIn: 3600,
      });
    }
    if (p === "/api/v1/me/patient-profile") {
      return reply({
        patientId: "11111111-1111-4111-8111-111111111111",
        firstName: "Paciente",
        lastName: "QA",
        documentNumber: "QA",
        email: "qa@example.invalid",
        phone: "3001234567",
        emergencyName: "",
        emergencyPhone: "",
        emergencyRelationship: "",
        emergencyEmail: "",
        secondaryEmergencyContact: null,
        insurerId: null,
        memberId: "",
      });
    }
    return reply([]);
  });
}

async function enterOnboarding(page, baseUrl) {
  await page.goto(baseUrl);
  await page
    .getByRole("button", { name: "Activa tu cuenta", exact: true })
    .click();
  await page.locator("#login-first-id input").fill("QA");
  await page
    .getByRole("button", { name: "Confirmar identidad", exact: true })
    .click();
  await page.getByRole("radio").first().click();
  await page.locator("#login-otp-0").fill("123456");
  await page
    .getByRole("button", { name: "Verificar y entrar", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Correo", exact: true }),
  ).toBeVisible();
}

async function shot(page, name) {
  await page.screenshot({
    path: path.join(out, `${name}.png`),
    fullPage: false,
    animations: "disabled",
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  assert.equal(overflow, false, `horizontal overflow in ${name}`);
}

async function continueButton(page) {
  return page.getByRole("button", { name: "Continuar", exact: true }).first();
}

async function fillNumeric(page, field, value) {
  const input = page.locator(`ion-input[data-wl-field="${field}"] input`);
  await input.fill(String(value));
}

async function answerAllNo(page, count) {
  for (let index = 0; index < count; index += 1) {
    const question = page.locator(".wl-question").nth(index);
    await question.getByRole("button", { name: "No", exact: true }).click();
  }
}

async function runFlow(page, baseUrl, width) {
  await page.setViewportSize({ width, height: width <= 320 ? 720 : 860 });
  await enterOnboarding(page, baseUrl);

  await shot(page, `01-email-${width}`);
  await page
    .locator('ion-input[name="email"] input')
    .fill(`ana.qa.${width}@example.com`);
  await (await continueButton(page)).click();

  await expect(
    page.getByText("Contactos de emergencia", { exact: true }),
  ).toBeVisible();
  await shot(page, `02-emergencia-${width}`);
  await (await continueButton(page)).click();
  await expect(
    page.getByText("El contacto principal requiere nombre y teléfono.", {
      exact: true,
    }),
  ).toBeVisible();
  const contact = page.locator(
    ".emergency-contact-card-primary ion-input input",
  );
  await contact.nth(0).fill("Ana Torres");
  await contact.nth(1).fill("3001234567");
  await (await continueButton(page)).click();

  await expect(
    page.getByText("Términos de bienestar", { exact: true }),
  ).toBeVisible();
  await shot(page, `03-terminos-${width}`);
  await page.locator("ion-checkbox").first().click();
  await (await continueButton(page)).click();

  await expect(
    page.getByText("Crea tu contraseña", { exact: true }),
  ).toBeVisible();
  await shot(page, `04-contrasena-${width}`);
  await page.locator('ion-input[name="new-password"] input').fill("Segura123!");
  await page
    .locator('ion-input[name="confirm-password"] input')
    .fill("Segura123!");
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();

  await expect(
    page.getByRole("heading", { name: "Tu objetivo", exact: true }),
  ).toBeVisible();
  await shot(page, `05-objetivo-${width}`);
  await page.locator('button[aria-label="Bajar de peso"]').click();
  await (await continueButton(page)).click();

  await expect(page.getByText("Tus datos", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Femenino", exact: true }).click();
  await page.locator('ion-input[data-wl-field="name"] input').fill("Ana");
  await fillNumeric(page, "age", 34);
  await fillNumeric(page, "heightCm", 165);
  await fillNumeric(page, "weightKg", 72);
  await fillNumeric(page, "waistCm", 82);
  await fillNumeric(page, "targetWeightKg", 65);
  await shot(page, `06-datos-${width}`);
  await (await continueButton(page)).click();

  await expect(
    page.getByText("Actividad y ritmo", { exact: true }),
  ).toBeVisible();
  await page.locator(".wl-option").filter({ hasText: "Ligero" }).click();
  await shot(page, `07-actividad-${width}`);
  await (await continueButton(page)).click();

  await expect(
    page.getByText("Preferencias de alimentación", { exact: true }),
  ).toBeVisible();
  await shot(page, `08-preferencias-${width}`);
  await (await continueButton(page)).click();

  await expect(
    page.getByText("Seguridad del ejercicio", { exact: true }),
  ).toBeVisible();
  await answerAllNo(page, 7);
  await shot(page, `09-parq-${width}`);
  await (await continueButton(page)).click();

  await expect(
    page.getByText("Seguridad de la nutrición", { exact: true }),
  ).toBeVisible();
  await answerAllNo(page, 6);
  await shot(page, `10-nqs-${width}`);
  await (await continueButton(page)).click();

  await expect(
    page.getByText("Términos y aviso de bienestar", { exact: true }),
  ).toBeVisible();
  await shot(page, `11-terminos-plan-${width}`);
  await (await continueButton(page)).click();

  await expect(
    page.getByText("Revisa tus elecciones", { exact: true }),
  ).toBeVisible();
  await shot(page, `12-revision-${width}`);
  await page
    .getByRole("button", { name: "Generar mi plan", exact: true })
    .click();

  await expect(
    page.getByRole("heading", { name: /tu plan de bienestar está listo/i }),
  ).toBeVisible();
  await expect(page.getByText("Día 1/365", { exact: true })).toBeVisible();
  await shot(page, `13-plan-listo-${width}`);

  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.locator(".wh-day")).toContainText("Día 1 de 365");
  await expect(
    page.getByText("Protocolo de hoy", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("0/5", { exact: true })).toBeVisible();
  await expect(page.getByText("0 de 7", { exact: true })).toBeVisible();
  await expect(page.getByText(/^(IMC|HbA1c|% de grasa)$/)).toHaveCount(0);
  await page.waitForTimeout(1200);
  const afterEnter = await page.evaluate(() => ({
    text: document.body.innerText.slice(0, 400),
    nodes: document.body.querySelectorAll("*").length,
  }));
  await shot(page, `14-inicio-${width}`);
  await page.locator(".wh-batteries").scrollIntoViewIfNeeded();
  await shot(page, `15-cuestionarios-${width}`);

  await page
    .getByRole("button", { name: "Empezar mi día", exact: true })
    .click();
  await expect(
    page.getByText("Tu día de bienestar", { exact: true }),
  ).toBeVisible();
  await shot(page, `16-protocolo-${width}`);
  for (let step = 0; step < 4; step += 1) {
    await page
      .getByRole("button", { name: "Marcar como hecho", exact: true })
      .first()
      .click();
  }
  await expect(page.getByText("4 de 5 pasos", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Abrir mi cofre", exact: true })
    .click();
  await expect(
    page.getByText("¡Cofre abierto!", { exact: true }),
  ).toBeVisible();
  await shot(page, `17-cofre-${width}`);
  await page.getByRole("button", { name: "Seguir", exact: true }).click();
  await expect(page.getByText("5 de 5 pasos", { exact: true })).toBeVisible();
  await shot(page, `18-protocolo-completo-${width}`);
  await page
    .getByRole("button", { name: "Volver al inicio", exact: true })
    .click();
  await expect(page.getByText("5/5", { exact: true })).toBeVisible();
  await shot(page, `19-home-completo-${width}`);

  return afterEnter;
}

const baseUrl = process.env.COP_E2E_APP_URL ?? "http://127.0.0.1:5173";

try {
  for (const width of process.env.COP_E2E_WIDTH
    ? [Number(process.env.COP_E2E_WIDTH)]
    : [390, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: 860 },
    });
    await mockApi(context);
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const runtimeErrors = [];
    page.on("pageerror", (error) =>
      runtimeErrors.push(
        `pageerror: ${error.message} @ ${String(error.stack).slice(0, 700)}`,
      ),
    );
    page.on("console", (message) => {
      if (message.type() === "error")
        runtimeErrors.push(`console: ${message.text()}`);
    });
    try {
      const afterEnter = await runFlow(page, baseUrl, width);
      results.push({
        width,
        result: "passed",
        afterEnter,
        runtimeErrors: runtimeErrors.slice(0, 8),
      });
    } catch (error) {
      results.push({
        width,
        result: "failed",
        error: String(error).slice(0, 900),
      });
      await page
        .screenshot({
          path: path.join(out, `failure-${width}.png`),
          fullPage: true,
        })
        .catch(() => {});
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

await writeFile(
  path.join(out, "kan136-results.json"),
  JSON.stringify(results, null, 2),
  "utf8",
);
console.log(JSON.stringify(results));
if (results.some((r) => r.result === "failed")) process.exitCode = 1;
