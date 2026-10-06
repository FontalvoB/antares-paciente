/**
 * Verificación E2E del número de emergencia del SOS según la zona horaria.
 *
 * Abre la app en Chromium (Playwright) con tres zonas horarias simuladas y
 * comprueba el botón "Llamar {numero}" del protocolo SOS:
 *   - America/Bogota   → 123
 *   - America/New_York → 911
 *   - Europe/Madrid    → 911 (respaldo para zonas no reconocidas)
 *
 * No necesita backend: intercepta las llamadas de sesión y /api/** con
 * respuestas simuladas (el login real no es necesario). Requiere SOLO el dev
 * server de Vite corriendo (`npm run dev`, http://localhost:5173).
 *
 * Uso:              node scripts/sos-emergency-number-check.mjs
 * Otra URL base:    SOS_CHECK_URL=http://localhost:5174 node scripts/sos-emergency-number-check.mjs
 */
import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE_URL = process.env.SOS_CHECK_URL ?? "http://localhost:5173";
const SHOTS_DIR = path.join(os.tmpdir(), "sos-emergency-number-check");

const CASES = [
  { timeZone: "America/Bogota", expected: "123" },
  { timeZone: "America/New_York", expected: "911" },
  { timeZone: "Europe/Madrid", expected: "911" },
];

/** DTO creíble del perfil del paciente para no depender del backend. */
const PATIENT_PROFILE = {
  patientId: "demo-paciente",
  firstName: "Paciente",
  lastName: "Demo",
  documentNumber: "55551234",
  dateOfBirth: "1990-01-01T00:00:00Z",
  email: "demo@coppaddresd.com",
  phone: "+57 300 000 0000",
  emergencyName: "Contacto Demo",
  emergencyRelationship: "Familiar",
  emergencyPhone: "+57 300 111 1111",
  emergencyEmail: "contacto@coppaddresd.com",
  insurerId: null,
  memberId: "DEMO-1",
};

/** Simula la sesión autenticada y el resto de /api/** sin backend. */
async function mockBackend(context) {
  // Token sembrado: restoreSession() intenta refresh y luego getMe().
  await context.addInitScript(() => {
    localStorage.setItem("copp_access_token", "demo-access-token");
  });

  await context.route("**/api/**", (route) => {
    const url = route.request().url();

    if (url.includes("/api/auth/refresh")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accessToken: "demo-access-token",
          tokenType: "Bearer",
          expiresIn: 3600,
        }),
      });
    }

    if (url.includes("/api/auth/me")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "demo-paciente",
          email: "demo@coppaddresd.com",
          firstName: "Paciente",
          lastName: "Demo",
          roles: ["Paciente"],
          permissions: [],
        }),
      });
    }

    if (url.includes("/api/v1/me/patient-profile")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(PATIENT_PROFILE),
      });
    }

    if (url.includes("/api/v1/program/me/metrics-history")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ heightCm: null, metrics: [] }),
      });
    }

    if (url.includes("/api/v1/program/me/scores-history")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ points: [] }),
      });
    }

    // Cualquier otro endpoint: respuesta vacía (la app degrada sin backend).
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });
}

const browser = await chromium.launch({ headless: true });
try {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });

  for (const { timeZone, expected } of CASES) {
    const context = await browser.newContext({
      timezoneId: timeZone,
      viewport: { width: 390, height: 844 },
    });
    await mockBackend(context);

    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });

    // El shell de la app monta la barra inferior con el botón SOS.
    await page
      .getByRole("button", { name: "Botón de pánico" })
      .click({ timeout: 90_000 });

    // El protocolo SOS muestra el número resuelto para esta zona horaria.
    const callButton = page.getByRole("button", {
      name: `Llamar ${expected}`,
      exact: true,
    });
    await callButton.waitFor({ state: "visible", timeout: 30_000 });

    const other = expected === "123" ? "911" : "123";
    assert.equal(
      await page
        .getByRole("button", { name: `Llamar ${other}`, exact: true })
        .count(),
      0,
      `[${timeZone}] no debería existir "Llamar ${other}"`,
    );
    assert.ok(
      (await page.getByText(`Emergencias ${expected}`, { exact: true }).count()) >
        0,
      `[${timeZone}] falta la fila "Emergencias ${expected}"`,
    );

    const shot = path.join(SHOTS_DIR, `${timeZone.replace(/\//g, "-")}.png`);
    await page.screenshot({ path: shot });

    console.log(`✓ ${timeZone} → "Llamar ${expected}" (captura: ${shot})`);
    await context.close();
  }
} finally {
  await browser.close();
}

console.log("\nTodo OK: 123 en Colombia, 911 en EE. UU. y 911 como respaldo.");
