/** KAN-83: Antares + ERP + API/Auth + PostgreSQL con cuentas sintéticas. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium, expect } from "playwright/test";

const fixturePath = process.env.KAN83_FIXTURE;
assert(fixturePath?.startsWith("/tmp/"), "Se requiere un fixture local de QA");
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
assert(fixture.database.startsWith("copp_review_medications_kan83_"));
const { patient, otherPatient, manager, reader } = fixture.accounts;
const gateway = fixture.gateway.replace("127.0.0.1", "localhost");
const app = process.env.KAN83_APP_URL ?? "http://localhost:5188";
const erp = process.env.KAN83_ERP_URL ?? "http://localhost:3100";
for (const origin of [gateway, app, erp]) {
  assert.equal(new URL(origin).hostname, "localhost");
}

const browser = await chromium.launch();
try {
  async function session(account, application, viewport) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const response = await context.request.post(gateway + "/api/auth/login", {
      data: { application, email: account.login, password: account.password, documentNumber: account.documentNumber },
    });
    assert.equal(response.status(), 200, `Inicio de sesión de prueba: ${application}`);
    const { accessToken } = await response.json();
    return { page: await context.newPage(), context, headers: { Authorization: `Bearer ${accessToken}` } };
  }

  async function openCameras(page) {
    await page.goto(app);
    await page.getByRole("navigation").getByRole("button", { name: "Perfil", exact: true }).click({ timeout: 40000 });
    await page.getByRole("button", { name: "Cámaras familiares", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Cámaras familiares" })).toBeVisible();
  }

  const leader = await session(patient, "app", { width: 390, height: 844 });
  await openCameras(leader.page);
  await leader.page.getByRole("textbox", { name: "Nombre del equipo" }).fill("Familia de prueba");
  await leader.page.getByRole("button", { name: "Crear equipo", exact: true }).click();
  await expect(leader.page.getByText("Familia de prueba", { exact: true })).toBeVisible();
  await leader.page.getByRole("button", { name: "Generar código", exact: true }).click();
  const invite = leader.page.getByTestId("family-invitation-code");
  await expect(invite).toBeVisible();

  const member = await session(otherPatient, "app", { width: 320, height: 844 });
  await openCameras(member.page);
  await member.page.getByRole("textbox", { name: "Código de invitación" }).fill((await invite.innerText()).trim());
  await member.page.getByRole("button", { name: "Unirme al equipo", exact: true }).click();
  await expect(member.page.getByText("Familia de prueba", { exact: true })).toBeVisible();
  await expect(member.page.getByRole("button", { name: "Generar código", exact: true })).toHaveCount(0);
  await member.page.getByRole("textbox", { name: "Nombre de la cámara" }).fill("Sala de prueba");
  await member.page.getByRole("button", { name: "Añadir cámara de prueba", exact: true }).click();
  const camera = member.page.getByRole("article", { name: "Sala de prueba", exact: true });
  await expect(camera).toBeVisible();
  assert.equal(await member.page.evaluate(() => document.documentElement.scrollWidth), 320, "Mobile view fits a 320px screen");
  assert(await camera.evaluate((card) => {
    const right = card.getBoundingClientRect().right;
    return [...card.querySelectorAll("ion-badge, ion-toggle")].every((control) => control.getBoundingClientRect().right <= right);
  }), "Camera badge and switches fit inside the card on mobile");
  await expect(camera.getByRole("switch", { name: "Compartir con el líder" })).not.toBeChecked();
  await expect(camera.getByRole("switch", { name: "Compartir con administradores" })).not.toBeChecked();

  const admin = await session(manager, "erp", { width: 1320, height: 900 });
  const adminCamerasPath = `/api/v1/family-cameras/patients/${fixture.otherPatientId}`;
  await admin.page.goto(`${erp}/patients/${fixture.otherPatientId}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await admin.page.getByRole("tab", { name: "Cámaras", exact: true }).click({ timeout: 40000 });
  await expect(admin.page.getByText("Este paciente no ha compartido cámaras.", { exact: true })).toBeVisible();
  await leader.page.getByRole("button", { name: "Actualizar cámaras" }).click();
  await expect(leader.page.getByText("Sala de prueba", { exact: true })).toHaveCount(0);

  const saveSharing = async (changes) => {
    const update = member.page.waitForRequest((request) =>
      request.method() === "PATCH" && request.url().endsWith("/sharing"));
    await camera.getByRole("button", { name: "Guardar acceso", exact: true }).click();
    assert.deepEqual((await update).postDataJSON(), changes);
    await expect(camera.getByRole("status")).toContainText("Acceso actualizado");
  };
  await camera.getByRole("switch", { name: "Compartir con el líder" }).click();
  await saveSharing({ leader: true });
  const adminWithoutConsent = await admin.context.request.get(gateway + adminCamerasPath, { headers: admin.headers });
  assert.equal(adminWithoutConsent.status(), 200);
  assert.deepEqual(await adminWithoutConsent.json(), [], "Leader consent is independent of ERP consent");

  async function openFeed(page, simulateConnectionError = false) {
    await page.bringToFront();
    await page.getByRole("button", { name: "Actualizar cámaras" }).click();
    const previewRequest = /\/api\/v1\/family-cameras\/patients\/[^/]+\/[^/]+\/frame$/;
    const failPreview = (route) => route.fulfill({ status: 503 });
    if (simulateConnectionError) {
      await page.route(previewRequest, failPreview);
    }
    await page.getByRole("article", { name: "Sala de prueba", exact: true })
      .getByRole("button", { name: "Ver cámara", exact: true }).click();
    if (simulateConnectionError) {
      await expect(page.getByText("No pudimos conectar con la cámara.")).toBeVisible();
      await page.unroute(previewRequest, failPreview);
      await page.getByRole("button", { name: "Reintentar", exact: true }).click();
    }
    const frame = page.getByRole("img", { name: "Imagen de la cámara", exact: true });
    await expect.poll(() => frame.evaluate((element) => element.naturalWidth)).toBeGreaterThan(0);
    return frame;
  }

  const leaderFrame = await openFeed(leader.page);
  await camera.getByRole("switch", { name: "Compartir con administradores" }).click();
  await saveSharing({ administrators: true });
  const adminFrame = await openFeed(admin.page, true);
  const frameSource = await adminFrame.getAttribute("src");
  await expect.poll(() => adminFrame.getAttribute("src")).not.toEqual(frameSource);
  if (process.env.KAN83_SCREENSHOTS) {
    for (const [page, name] of [[member.page, "miembro"], [leader.page, "lider"], [admin.page, "erp"]]) {
      await page.bringToFront();
      if (page !== member.page) await expect(page.getByRole("img", { name: "Imagen de la cámara" })).toBeVisible();
      await page.screenshot({ path: `${process.env.KAN83_SCREENSHOTS}/${name}.png` });
    }
  }

  await camera.getByRole("switch", { name: "Compartir con el líder" }).click();
  await saveSharing({ leader: false });
  await leader.page.bringToFront();
  await expect(leaderFrame).toHaveCount(0);
  await expect(leader.page.getByText("El acceso a esta cámara ya no está disponible.", { exact: true })).toBeVisible();
  await admin.page.bringToFront();
  await expect(adminFrame).toBeVisible();

  await camera.getByRole("switch", { name: "Compartir con administradores" }).click();
  await saveSharing({ administrators: false });
  await admin.page.bringToFront();
  await expect(adminFrame).toHaveCount(0);
  await expect(admin.page.getByText("El acceso a esta cámara ya no está disponible.", { exact: true })).toBeVisible();

  const staff = await session(reader, "erp", { width: 1100, height: 770 });
  for (const session of [staff, leader]) {
    const response = await session.context.request.get(gateway + adminCamerasPath, { headers: session.headers });
    assert.equal(response.status(), 403);
  }
  assert.equal((await admin.context.request.get(gateway + adminCamerasPath, {
    headers: { ...admin.headers, "X-Clinic-Id": fixture.clinicId },
  })).status(), 404, "An active clinic cannot see a patient from a different clinic");
  console.log("KAN-83: alta en familia, cámara privada, reproducción app/ERP y revocación verificadas.");
} finally {
  await browser.close();
}
