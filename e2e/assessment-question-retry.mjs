/** App browser E2E with synthetic assessment reads. No patient records are written. */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium, webkit, expect } from "playwright/test";

const baseUrl = process.env.COP_E2E_APP_URL ?? "http://127.0.0.1:5197";
const output = process.env.COP_E2E_OUTPUT;
if (output) await mkdir(output, { recursive: true });
const patientId = "11111111-1111-4111-8111-111111111111";
const assignmentId = "22222222-2222-4222-8222-222222222222";
const draftKey = `assessment-draft:v1:${patientId}:${assignmentId}`;
const testPath = `/api/v1/health-tests/me/tests/${assignmentId}`;
const draft = { answers: { 0: [1] }, step: 1 };
const token = "x." + Buffer.from(JSON.stringify({
  sub: patientId, exp: Math.floor(Date.now() / 1000) + 3600,
})).toString("base64url") + ".x";

for (const [engine, width, language] of [
  [chromium, 390, "es"],
  [webkit, 320, "en"],
  [chromium, 1280, "en"],
]) {
  if (process.env.COP_E2E_BROWSER && engine.name() !== process.env.COP_E2E_BROWSER) continue;
  const english = language === "en";
  const copy = {
    menu: english ? "More options" : "Más opciones",
    profile: english ? "Profile" : "Perfil",
    assessments: english ? "Wellness assessments" : "Evaluaciones de bienestar",
    title: english ? "How active are you?" : "¿Qué tan activo/a eres?",
    loading: english ? "Preparing your assessment…" : "Preparando tu evaluación…",
    error: english ? "Unable to load the questions. Please try again." :
      "No se pudieron cargar las preguntas. Intenta nuevamente.",
    retry: english ? "Retry" : "Reintentar",
    back: english ? "Go back" : "Volver",
    question: english ? "Which activities are part of your day?" :
      "¿Qué actividades forman parte de tu día?",
    selected: english ? "Walking" : "Caminar",
  };
  const browser = await engine.launch();
  const page = await browser.newPage({
    viewport: { width, height: 900 }, reducedMotion: "reduce", serviceWorkers: "block",
  });
  page.setDefaultTimeout(8000);
  const mutations = [];
  let reads = 0;
  const waits = [Promise.withResolvers(), Promise.withResolvers(), Promise.withResolvers()];
  try {
    await page.addInitScript(({ language, draftKey, draft }) => {
      localStorage.setItem("antares_lang", language);
      localStorage.setItem(draftKey, JSON.stringify(draft));
    }, { language, draftKey, draft });

    await page.route("**/api/**", async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const json = (body) => route.fulfill({ json: body });
      if (path === "/api/auth/refresh") return json({ accessToken: token, expiresIn: 3600 });
      if (path === "/api/auth/me") return json({
        id: patientId, firstName: "QA", lastName: "Patient", roles: ["Patient"], permissions: [],
      });
      if (path === "/api/v1/me/patient-profile") return json({
        patientId, firstName: "QA", lastName: "Patient", documentNumber: "QA",
      });
      if (path === "/api/v1/telemedicine/me") return json({
        patient: { id: patientId, organizationId: patientId },
      });
      if (path === "/api/v1/professionals-catalog") return json({ data: [] });
      if (path === "/api/v1/health-tests/me/assignments") return json([{
        id: assignmentId, patientId, testName: copy.title,
        testCode: "movimiento", status: "in_progress",
      }]);
      if (path.startsWith("/api/v1/health-tests/") && request.method() !== "GET") {
        mutations.push(path);
        return route.fulfill({ status: 405, json: {} });
      }
      if (path === testPath) {
        const attempt = ++reads;
        await waits[attempt - 1]?.promise;
        if (attempt === 1 || attempt === 3) {
          return route.fulfill({ status: 503, json: { detail: "QA_PRIVATE_FAILURE" } });
        }
        return json({ name: copy.title, questions: [{
          id: "qa-question", code: "qa-habits", type: "multi", text: copy.question,
          options: [
            { id: "qa-1", text: english ? "Reading" : "Leer", isActive: true },
            { id: "qa-2", text: copy.selected, isActive: true },
          ],
          isActive: true,
        }] });
      }
      if (path === "/api/v1/health-tests/me/results") return json([]);
      return route.fulfill({ status: 404, json: {} });
    });

    await page.goto(baseUrl);
    await page.getByRole("button", { name: copy.menu, exact: true }).click();
    await page.getByRole("button", { name: copy.profile, exact: true }).click();
    await page.getByRole("button", { name: new RegExp(copy.assessments) }).click();
    const card = page.getByRole("button").filter({ hasText: copy.title });
    await card.click();
    await expect(page.getByText(copy.loading, { exact: true })).toBeVisible();
    waits[0].resolve();
    const retry = page.getByRole("button", { name: copy.retry, exact: true });
    await expect(retry).toBeVisible({ timeout: 2500 });
    await expect(page.getByRole("alert").filter({ hasText: copy.error })).toBeVisible();
    await expect(page.getByText("QA_PRIVATE_FAILURE")).toHaveCount(0);
    await expect(card).toHaveCount(0);
    assert.ok((await retry.boundingBox()).height >= 44, "Retry needs a 44px touch target");
    if (output) await page.screenshot({ path: join(output, `retry-${width}-${language}.png`) });
    await retry.click();
    await expect(page.getByRole("status").filter({ hasText: copy.loading })).toBeVisible();
    await expect(retry).toHaveCount(0);
    waits[1].resolve();
    await expect(page.getByText(copy.question, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(copy.selected), pressed: true })).toBeVisible();

    const back = page.getByRole("button", { name: copy.back, exact: true });
    await back.click();
    await expect(card).toBeVisible();
    await card.click();
    await expect.poll(() => reads).toBe(3);
    const lateResponse = page.waitForResponse(response => new URL(response.url()).pathname === testPath);
    await back.click();
    waits[2].resolve();
    await lateResponse;
    await expect(card).toBeVisible();
    await expect(retry).toHaveCount(0);
    assert.deepEqual(mutations, []);
    assert.deepEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), draftKey), draft);
    console.log(`${engine.name()}, ${width}px, ${language}: question retry and back navigation passed`);
  } finally {
    for (const wait of waits) wait.resolve();
    await browser.close();
  }
}
