import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, expect, webkit } from "playwright/test";
import { createServer } from "vite";

const userId = "11111111-1111-4111-8111-111111111111";
const submissionId = "22222222-2222-4222-8222-222222222222";
const generationId = "33333333-3333-4333-8333-333333333333";
const journey = "/api/v1/wellness/journey";
const pending = {
  submissionId, generationId, status: "pending", attempts: 1,
  exercise: { status: "pending" }, nutrition: { status: "pending" },
  inbox: { status: "pending", items: [] },
};
const exercise = { status: "ready", result: {
  version: "fixture", title: "Ejercicio persistido", items: ["Actividad de muestra"],
} };
const failed = {
  ...pending, status: "failed", exercise, nutrition: { status: "failed" },
  inbox: { status: "ready", items: [] },
};
const ready = {
  ...pending, status: "ready", attempts: 2, exercise,
  nutrition: { status: "ready", result: {
    version: "fixture", title: "Nutrición persistida", items: ["Menú de muestra"],
  } },
  inbox: { status: "ready", items: [{
    id: "welcome", title: "Mensaje persistido", body: "Mensaje de prueba", createdAt: "2026-11-24T12:00:00Z",
  }] },
};

async function runJourney(browser, url, width) {
  const context = await browser.newContext({ viewport: { width, height: 780 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  try {
    const token = `x.${Buffer.from(JSON.stringify({ sub: userId, exp: Date.now() / 1_000 + 3_600 })).toString("base64url")}.x`;
    const patient = { firstName: "Ana", lastName: "Prueba", email: "paid@example.invalid" };
    let generation = null;
    const submissions = [];
    const retries = [];
    await context.addInitScript(() => localStorage.setItem("antares_lang", "es"));
    await context.route("**/api/**", async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const reply = (json, status = 200) => route.fulfill({ json, status });
      if (path === "/api/auth/refresh") return reply({ accessToken: token, tokenType: "Bearer", expiresIn: 3_600 });
      if (path === "/api/auth/me") return reply({ id: userId, ...patient, roles: [], permissions: [] });
      if (path === "/api/v1/me/patient-profile") return reply({ patientId: userId, ...patient });
      if (path === `${journey}/latest`) {
        return generation ? reply(generation) : reply({ code: "no_generation" }, 404);
      }
      if (path === `${journey}/submissions` && request.method() === "POST") {
        submissions.push(request.postDataJSON());
        generation = pending;
        return reply(generation, 202);
      }
      if (path === `${journey}/generation/${generationId}/retry` && request.method() === "POST") {
        retries.push(request.postDataJSON());
        generation = ready;
        return reply(generation, 202);
      }
      return reply([]);
    });

    const button = (name) => page.getByRole("button", { name, exact: true });
    const heading = (name) => expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    const next = () => button("Continuar").click();
    const field = (name) => page.locator(`ion-input[data-wl-field="${name}"] input`);
    const assertLayout = async () => {
      const size = await page.locator(".journey-scroll").evaluate((node) => ({
        pageFits: document.documentElement.scrollWidth <= window.innerWidth + 1,
        containerFits: node.scrollWidth <= node.clientWidth + 1,
      }));
      assert.deepEqual(size, { pageFits: true, containerFits: true });
    };

    await page.goto(url);
    await expect(page.getByRole("heading", { name: "Cuéntanos tu objetivo" })).toBeVisible({ timeout: 15_000 });
    await expect(button("Subir masa muscular")).toHaveCount(0);
    await button("Bajar de peso").click();
    await next();
    await heading("Tus datos");
    await expect(field("name")).toHaveAttribute("placeholder", "Tu nombre");
    await expect(field("targetWeightKg")).toHaveAttribute("placeholder", "Ej. 68");
    await button("Femenino").click();
    for (const [name, value] of Object.entries({ age: 35, heightCm: 165, weightKg: 74, waistCm: 88 })) {
      await field(name).fill(String(value));
    }
    await assertLayout();
    // Simula «Continuar» después de que cambió el control, antes de que llegue el evento de Ionic.
    await field("targetWeightKg").evaluate((input) => {
      input.value = "68";
      [...document.querySelectorAll("ion-button")].find((node) => node.textContent.trim() === "Continuar").click();
    });
    await heading("Actividad y ritmo");
    await page.locator(".wl-option").filter({ hasText: "Ligero" }).click();
    await next();
    await heading("Preferencias de alimentación");
    await next();
    for (const [title, count] of [["Seguridad del ejercicio", 7], ["Seguridad de la nutrición", 6]]) {
      await heading(title);
      for (let index = 0; index < count; index++) {
        await page.locator(".wl-question").nth(index).getByRole("button", { name: "No", exact: true }).click();
      }
      await next();
    }
    await heading("Términos y aviso de bienestar");
    await next();
    await heading("Términos y aviso de bienestar");
    assert.equal(submissions.length, 0);
    await page.locator('ion-checkbox[data-wl-field="terms"]').evaluate((checkbox) => {
      checkbox.checked = true;
      [...document.querySelectorAll("ion-button")].find((node) => node.textContent.trim() === "Continuar").click();
    });
    await heading("Revisa tus elecciones");

    await button("Generar mi plan").click();
    await heading("Inicio");
    await expect(page.getByText("Estamos preparando tu plan")).toBeVisible();
    generation = failed;
    await expect(button("Reintentar generación")).toBeVisible();
    await expect(page.getByText("Ejercicio persistido")).toBeVisible();
    await button("Reintentar generación").click();
    await expect(page.getByText("Tu plan y tu bandeja están listos")).toBeVisible();
    await heading("Plan de ejercicio");
    await heading("Plan de nutrición");
    await heading("Bandeja de entrada");
    await expect(page.getByText("Mensaje persistido")).toBeVisible();
    await assertLayout();

    await page.reload();
    await expect(page.getByText("Tu plan y tu bandeja están listos")).toBeVisible();
    await expect(page.getByText("Mensaje persistido")).toBeVisible();
    assert.equal(submissions.length, 1);
    assert.match(submissions[0].submissionId, /^[0-9a-f-]{36}$/i);
    assert.equal(submissions[0].draft.goal, "bajar");
    assert.equal(submissions[0].draft.targetWeightKg, 68);
    assert.deepEqual(submissions[0].draft.parq, Array(7).fill(0));
    assert.ok(submissions[0].draft.terms?.acceptedAt);
    assert.deepEqual(retries, [{ expectedAttempts: 1 }]);
    await button("Cambiar idioma a English").click();
    await heading("Home");
    await heading("Inbox");
    await assertLayout();
  } catch (error) {
    const snapshot = await page.locator("body").ariaSnapshot({ timeout: 2_000 }).catch(() => "");
    if (snapshot) console.error(snapshot);
    throw error;
  } finally {
    await context.close();
  }
}

// El servidor sirve la app real. Todas las peticiones a la API están simuladas.
Object.assign(process.env, { VITE_WELLNESS_JOURNEY_DEMO: "true", VITE_GATEWAY_BASE_URL: "http://127.0.0.1:1" });
const cacheDir = await mkdtemp(join(tmpdir(), "antares-journey-e2e-"));
let server;
try {
  server = await createServer({ cacheDir, server: { host: "127.0.0.1", port: 0 } });
  await server.listen();
  const url = new URL("/?wellnessJourney=1", server.resolvedUrls.local[0]).href;
  for (const type of process.argv.includes("--webkit") ? [webkit] : [chromium]) {
    const browser = await type.launch();
    try {
      for (const width of [320, 390]) {
        await runJourney(browser, url, width);
        console.log(`${type.name()} ${width}px: cuestionario, recarga, reintento e idiomas verificados`);
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  await server?.close();
  await rm(cacheDir, { recursive: true, force: true });
}
