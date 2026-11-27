/** KAN-161: npm run dev -- --port 41761, then node e2e/vitals-trend-availability.mjs */
import { chromium, webkit, expect } from "playwright/test";

const origin = process.env.KAN161_APP_URL ?? "http://127.0.0.1:41761";
const now = new Date("2026-11-27T17:00:00Z");
const patientId = "11111111-1111-4111-8111-111111111111";
const token = "x." + Buffer.from(JSON.stringify({
  sub: patientId,
  exp: Math.floor(now.getTime() / 1000) + 86400,
})).toString("base64url") + ".x";

const labels = {
  es: {
    menu: "Más opciones",
    profile: "Perfil",
    vitals: "Signos vitales",
    history: "Historial",
    few: "No hay datos suficientes para mostrar una tendencia.",
    unavailable: "Tendencia no disponible.",
    classification: /Tendencia:|Mejorando|Empeorando|Manteniéndose/,
  },
  en: {
    menu: "More options",
    profile: "Profile",
    vitals: "Vital signs",
    history: "History",
    few: "Not enough data to show a trend.",
    unavailable: "Trend unavailable.",
    classification: /Trend:|Improving|Worsening|Steady/,
  },
};

for (const [engine, lang] of [[chromium, "es"], [webkit, "en"]]) {
  const copy = labels[lang];
  const browser = await engine.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 820 }, timezoneId: "America/Bogota" });
    const diagnostics = [];
    page.on("pageerror", (error) => diagnostics.push(error.message));
    page.on("request", (request) => {
      if (request.url().includes("/api/")) diagnostics.push(request.method() + " " + new URL(request.url()).pathname);
    });
    await page.clock.setFixedTime(now);
    await page.addInitScript(({ patientId, lang, token }) => {
      localStorage.setItem("antares_lang", lang);
      localStorage.setItem("copp_access_token", token);
      const at = new Date().toISOString();
      localStorage.setItem("copp.ai-disclosure." + patientId, JSON.stringify({
        version: "2026-11-21-health", acceptedAt: at,
      }));
      localStorage.setItem(`copp.wellness-privacy.audit.v1.${at}.00000000.e2e`, JSON.stringify({
        action: "accepted", actor: patientId, scope: "sensitive-data", version: "2026-11-25-draft.1", acceptedAt: at, at,
      }));
      localStorage.setItem("wellness.plan.v1", JSON.stringify({
        name: "QA", goal: "bajar", startDate: "2026-11-01", createdAt: new Date().toISOString(),
        totalDays: 365, kcal: 1660, proteinG: 115, carbsG: 201, fatG: 44, waterMl: 2500,
      }));
      localStorage.setItem("wellness.vitals.v1." + patientId, JSON.stringify({
        heartRate: Object.fromEntries([
          ["2026-11-10", 72], ["2026-11-24", 90], ["2026-11-27", 91],
        ].map(([date, value]) => [date, {
          date, value, source: "manual", measuredAt: date + "T12:00:00Z", timezoneOffset: 300, previous: [],
        }])),
      }));
    }, { patientId, lang, token });
    await page.route("**/api/**", (route) => {
      const { pathname } = new URL(route.request().url());
      const reply = (json) => route.fulfill({ json });
      if (pathname === "/api/auth/refresh") return reply({ accessToken: token, expiresIn: 86400 });
      if (pathname === "/api/auth/me") return reply({ id: patientId, firstName: "QA", roles: ["Patient"], permissions: [] });
      if (pathname === "/api/v1/me/patient-profile") return reply({ patientId, firstName: "QA", documentNumber: "QA" });
      if (pathname === "/api/v1/me/context") return reply({ patient: { id: patientId, organizationId: patientId }, clinics: [] });
      if (pathname === "/api/v1/me/legal-consents") return reply({ locale: lang, scopes: [] });
      if (pathname.startsWith("/api/v1/people/me/")) return route.fulfill({ status: 404 });
      if (pathname.endsWith("/messages")) return reply({ messages: [], messageCount: 0, lastMessage: null });
      return reply({});
    });

    await page.goto(origin);
    await page.getByRole("button", { name: copy.menu, exact: true }).click();
    const profile = page.getByRole("button", { name: copy.profile, exact: true });
    await profile.click({ timeout: 8000 }).catch(async (error) => {
      console.error(await page.locator("body").innerText(), diagnostics);
      throw error;
    });
    await page.getByText(copy.vitals, { exact: true }).click();
    await expect(page.getByRole("heading", { name: copy.vitals, exact: true })).toBeVisible();
    const history = page.getByRole("region", { name: copy.history, exact: true });
    await expect(history.getByRole("img")).toBeVisible();
    await expect(history.locator(".wv-days > li")).toHaveCount(2);

    await history.locator('ion-segment-button[value="30"]').click();
    await expect(history.locator(".wv-days > li")).toHaveCount(3);
    await expect(history.getByText(copy.classification)).toHaveCount(0, { timeout: 2200 });
    await expect(history.getByText(copy.unavailable, { exact: true })).toBeVisible();

    await history.locator('ion-segment-button[value="7"]').click();
    await expect(history.getByText(copy.few, { exact: true })).toBeVisible();
    console.log(`KAN-161: ${engine.name()} ${lang} retains history without unsupported labels`);
  } finally {
    await browser.close();
  }
}
