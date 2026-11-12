/** Browser E2E: synthetic APIs; no real patient/model writes. */
import { chromium, expect } from "playwright/test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
const out = process.env.COP_E2E_OUTPUT ?? "/tmp/copp-hide-appointments";
await mkdir(out, { recursive: true });
const restored = process.env.COP_E2E_MODE === "restored";
const browser = await chromium.launch();
const results = [];
for (const lang of restored ? ["es"] : ["es", "en"])
  for (const width of restored ? [390] : [390, 1280]) {
    const context = await browser.newContext({
      viewport: { width, height: 950 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const id = randomUUID(),
      reads = [],
      writes = [];
    const token =
      "x." +
      Buffer.from(
        JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600 }),
      ).toString("base64url") +
      ".x";
    await page.addInitScript(
      (lang) => localStorage.setItem("antares_lang", lang),
      lang,
    );
    await context.route("**/api/**", async (route) => {
      const req = route.request(),
        p = new URL(req.url()).pathname;
      const reply = (json) => route.fulfill({ json });
      if (req.method() === "GET") reads.push(p);
      else if (!p.startsWith("/api/auth/")) writes.push(p);
      if (p === "/api/auth/refresh")
        return reply({ accessToken: token, expiresIn: 3600 });
      if (p === "/api/auth/me")
        return reply({
          id,
          firstName: "QA",
          lastName: "Paciente",
          roles: ["Patient"],
          permissions: [],
        });
      if (p === "/api/v1/me/patient-profile")
        return reply({
          patientId: id,
          firstName: "QA",
          lastName: "Paciente",
          documentNumber: "QA",
        });
      if (p === "/api/v1/me/context" || p === "/api/v1/telemedicine/me")
        return reply({ patient: { id, organizationId: id }, clinics: [] });
      if (p === "/api/v1/program/notifications")
        return reply({
          items: [
            {
              id: "qa-appt",
              type: "appointment_reminder",
              title: "QA cita oculta",
              message: "QA agendada",
              sentAt: new Date().toISOString(),
              readAt: null,
            },
            {
              id: "qa-nut",
              type: "nutrition_reminder",
              title: "QA nutrición visible",
              message: "QA alimentación",
              sentAt: new Date().toISOString(),
              readAt: null,
            },
          ],
          unreadCount: 2,
          totalCount: 2,
          page: 1,
          pageSize: 50,
          totalPages: 1,
        });
      if (p === "/api/v1/chat/stream")
        return route.fulfill({
          contentType: "text/event-stream",
          body:
            "data: " +
            JSON.stringify({
              type: "token",
              content:
                "QA hábitos útiles. [Mis citas](https://erp.coppadresd.com/appointments)",
            }) +
            "\n\ndata: " +
            JSON.stringify({
              type: "done",
              answer:
                "QA hábitos útiles. [Mis citas](https://erp.coppadresd.com/appointments)",
              thread_id: "qa-thread",
              execution_id: randomUUID(),
              suggestions: [
                { type: "appointment", ctaText: "QA reservar cita" },
              ],
            }) +
            "\n\n",
        });
      if (p.endsWith("/notifications/qa-nut/read"))
        return route.fulfill({ status: 204, body: "" });
      if (p.includes("/requests")) return reply([]);
      if (p.includes("/appointments")) return reply({ items: [] });
      if (p.includes("/professionals-catalog"))
        return reply({
          data: [],
          total: 0,
          page: 1,
          pageSize: 100,
          totalPages: 1,
        });
      if (p.endsWith("/specialties")) return reply([]);
      return route.fulfill({ status: 404, json: {} });
    });
    try {
      await page.goto(process.env.COP_E2E_APP_URL ?? "http://localhost:5188");
      const nav = page.locator(".bnav");
      if (restored) {
        await expect(
          nav.getByRole("button", { name: "Citas", exact: true }),
        ).toBeVisible();
        await nav.getByRole("button", { name: "Citas", exact: true }).click();
        await expect(
          page.getByRole("heading", { name: "Mis citas", exact: true }),
        ).toBeVisible();
        await expect
          .poll(() => reads.some((p) => p.includes("/appointments/mine")))
          .toBe(true);
        results.push({ lang, width, passed: true, restored: true });
        await context.close();
        continue;
      }
      await expect(
        nav.getByRole("button", {
          name: lang === "es" ? "Nutrición" : "Nutrition",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        nav.getByRole("button", {
          name: lang === "es" ? "Citas" : "Appointments",
          exact: true,
        }),
      ).toHaveCount(0);
      await nav
        .getByRole("button", {
          name: lang === "es" ? "Nutrición" : "Nutrition",
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("heading", {
          name: lang === "es" ? "Nutrición" : "Nutrition",
          exact: true,
        }),
      ).toBeVisible();
      await expect
        .poll(() =>
          reads.some((p) => p.startsWith("/api/v1/me/nutrition-plan")),
        )
        .toBe(true);
      await nav
        .getByRole("button", {
          name: lang === "es" ? "Perfil" : "Profile",
          exact: true,
        })
        .click();
      await expect(
        page.getByText("Agenda, control y telemedicina", { exact: true }),
      ).toHaveCount(0);
      await nav.getByRole("button", { name: "Chat", exact: true }).click();
      await expect(
        page.locator(".chat-quick-actions").getByRole("button", {
          name: lang === "es" ? "Agendar" : "Schedule",
          exact: true,
        }),
      ).toHaveCount(0);
      const input = page.locator("ion-input.chat-inp input");
      await input.fill("QA hábitos");
      await page
        .getByRole("button", {
          name: lang === "es" ? "Enviar" : "Send",
          exact: true,
        })
        .click();
      await expect(page.locator(".chat-list")).toContainText(
        "QA hábitos útiles.",
      );
      await expect(
        page.getByRole("button", { name: "QA reservar cita", exact: true }),
      ).toHaveCount(0);
      await expect(
        page.locator('.chat-list a[href*="/appointments"]'),
      ).toHaveCount(0);
      await nav
        .getByRole("button", {
          name: lang === "es" ? "Inicio" : "Home",
          exact: true,
        })
        .click();
      await expect(page.locator(".chat-list")).toHaveCount(0);
      await page.screenshot({ path: `${out}/navigation-${lang}-${width}.png` });
      await page
        .getByRole("button", { name: /Notificaciones|[Nn]otifications/ })
        .click();
      await expect(
        page.getByText("QA nutrición visible", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("QA cita oculta", { exact: true }),
      ).toHaveCount(0);
      await page.getByText("QA nutrición visible", { exact: true }).click();
      await expect(
        page.getByRole("heading", {
          name: lang === "es" ? "Nutrición" : "Nutrition",
          exact: true,
        }),
      ).toBeVisible();
      assert(!writes.some((path) => path.includes("qa-appt")));
      assert(
        !reads.some(
          (p) => p.includes("/appointments") || p.includes("/requests"),
        ),
      );
      assert.equal(
        writes.filter(
          (p) => p.includes("/appointments") || p.includes("/requests"),
        ).length,
        0,
      );
      await page.screenshot({ path: `${out}/mobile-${lang}-${width}.png` });
      results.push({ lang, width, passed: true });
    } catch (e) {
      console.log(lang, width, e.message);
      await page.screenshot({ path: `${out}/failure-${lang}-${width}.png` });
      results.push({ lang, width, passed: false, error: e.message });
    }
    await context.close();
  }
await browser.close();
await writeFile(
  `${out}/${restored ? "restored" : "mobile"}-results.json`,
  JSON.stringify(results, null, 2),
);
console.log(JSON.stringify(results));
if (results.some((r) => !r.passed)) process.exitCode = 1;
