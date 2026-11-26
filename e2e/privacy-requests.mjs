import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { chromium, expect } from "playwright/test";

const origin = "http://127.0.0.1:5187";
const backend = "http://127.0.0.1:5127";
const routePath = "/api/auth/privacy/requests";
const userA = "17000000-0000-4000-8000-000000000001";
const userB = "17000000-0000-4000-8000-000000000002";
const inactive = "17000000-0000-4000-8000-000000000003";
const checkFulfillment = process.env.COP_PRIVACY_QA_FULFILLMENT === "1";
const checkDownload = process.env.COP_PRIVACY_QA_EXPORT === "1";
const secretFile = process.env.COP_PRIVACY_QA_SECRET_FILE;
assert.ok(secretFile, "Provide a secret file for the isolated local Auth host");
const secret = (await readFile(secretFile, "utf8")).trim();
const token = (sub, aud = "app", claims = {}) => {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = [encode({ alg: "HS256", typ: "JWT" }), encode({
    sub, iss: "copp-kan170-local-qa", aud, exp: Math.floor(Date.now() / 1000) + 600, ...claims,
  })].join(".");
  return unsigned + "." + createHmac("sha256", secret).update(unsigned).digest("base64url");
};

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 320, height: 820 }, reducedMotion: "reduce" });
  let posts = 0;
  let emulateUnavailable = false;
  let breakNextPost = false;
  await context.addInitScript(() => localStorage.setItem("antares_lang", "es"));
  await context.route("**/api/**", async (route) => {
    const request = route.request();
    const reply = (json) => route.fulfill({ json });
    const path = new URL(request.url()).pathname;
    switch (/\/(?:full-)?download$/.test(path) ? routePath : path) {
      case "/api/auth/refresh": return reply({ accessToken: token(userA), expiresIn: 600 });
      case "/api/auth/me": return reply({ id: userA, firstName: "Paciente", lastName: "QA", roles: ["Patient"], permissions: [] });
      case "/api/v1/me/patient-profile": return reply({ patientId: userA, firstName: "Paciente", lastName: "QA", documentNumber: "QA" });
      case "/api/v1/me/context": return reply({ patient: { id: userA, organizationId: userA }, clinics: [] });
      case routePath: {
        if (emulateUnavailable) return route.fulfill({ status: 404, json: {} });
        if (request.method() === "POST" && new URL(request.url()).pathname === routePath) {
          posts++;
          if (breakNextPost) {
            breakNextPost = false;
            return route.fulfill({ status: 503, json: {} });
          }
        }
        const response = await context.request.fetch(backend + path, {
          method: request.method(),
          headers: { authorization: request.headers().authorization ?? "", "content-type": "application/json" },
          data: request.postData() ?? undefined,
        });
        return route.fulfill({ response });
      }
      default: return route.fulfill({ status: 404, json: {} });
    }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(6000);
  await page.goto(origin);
  const openPrivacy = () => page.getByRole("button", { name: "Privacidad y datos", exact: true }).click();
  await page.getByRole("button", { name: "Más opciones", exact: true }).click();
  await page.getByRole("button", { name: "Perfil", exact: true }).click();
  await openPrivacy();
  const panel = page.getByRole("region", { name: "Tus datos en el servidor" });
  await expect(panel).toBeVisible();
  assert.equal(await page.locator(".wellness-privacy-scroll").evaluate(el => el.scrollWidth > el.clientWidth), false);
  await expect(panel.getByText("No tienes solicitudes pendientes.")).toBeVisible();

  const req = (accessToken, data) => context.request.fetch(backend + routePath, {
    method: data === undefined ? "GET" : "POST",
    headers: accessToken ? { authorization: "Bearer " + accessToken } : {},
    data,
  });
  assert.equal((await req(null)).status(), 401);
  assert.equal((await req(token(inactive))).status(), 403);
  assert.equal((await req(token(userA), { kind: "deletion", confirmed: false })).status(), 400);
  assert.equal((await req(token(userA), { kind: "other" })).status(), 400);
  assert.equal((await req(token(userA), { kind: "export", format: "pdf" })).status(), 400);

  const exportButton = panel.getByRole("button", { name: "Solicitar copia de mis datos" });
  const deletionButton = panel.getByRole("button", { name: "Solicitar borrado de mis datos" });
  await deletionButton.click();
  const dialog = page.getByRole("alertdialog", { name: "¿Solicitar el borrado de tus datos del servidor?" });
  await expect(dialog.getByRole("button", { name: "Cancelar" })).toBeFocused();
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialog).toHaveCount(0);
  assert.equal(posts, 0);

  breakNextPost = true;
  const requestExport = async () => {
    await exportButton.click();
    const formatDialog = page.getByRole("alertdialog", { name: "Elige el formato de tu copia" });
    await formatDialog.getByRole("radio", { name: "CSV" }).click();
    await formatDialog.getByRole("button", { name: "Enviar solicitud" }).click();
    await expect(formatDialog).toHaveCount(0);
  };
  await requestExport();
  await expect(panel.getByRole("alert")).toContainText("No pudimos enviar tu solicitud");
  await requestExport();
  await expect(panel.getByRole("status")).toContainText("Copia solicitada (CSV)");
  const ownResponse = await req(token(userA));
  assert.match(ownResponse.headers()["cache-control"], /no-store/);
  const own = await ownResponse.json();
  assert.equal(own.export.format, "csv");
  assert.match(own.export.id, /^[0-9a-f-]{36}$/);
  await expect(panel.getByRole("status")).toContainText(own.export.id);

  await deletionButton.click();
  await dialog.getByRole("button", { name: "Enviar solicitud" }).click();
  await expect(panel.getByRole("status")).toContainText("Borrado solicitado");
  assert.equal(posts, 3);

  const same = await Promise.all(Array.from({ length: 4 }, () => req(token(userB), { kind: "export", format: "json" })));
  assert.deepEqual(same.map(r => r.status()).sort(), [200, 200, 200, 201]);
  const receipts = await Promise.all(same.map(r => r.json()));
  assert.equal(new Set(receipts.map(r => r.id)).size, 1);
  assert.notEqual(receipts[0].id, own.export.id);
  const other = await (await req(token(userB))).json();
  assert.deepEqual(other.export, receipts[0]);
  assert.equal(other.deletion, null);

  if (checkDownload) {
    const downloadButton = panel.getByRole("button", { name: "Descargar perfil y signos vitales" });
    await expect(downloadButton).toBeVisible();
    const csvDownload = page.waitForEvent("download");
    await downloadButton.click();
    const csvFile = await csvDownload;
    assert.equal(csvFile.suggestedFilename(), "perfil-y-vitales.csv");
    const csv = await readFile(await csvFile.path(), "utf8");
    assert.match(csv, /legacyVitals.*heartRate.*71/);
    assert.match(csv, /clinicalVitals.*value.*36.5/);
    assert.match(csv, /'=QA,/);
    assert.doesNotMatch(csv, /OTHER-SUBJECT|passwordHash|sourceKey/);

    const download = (user, id) => context.request.get(backend + routePath + "/" + id + "/download", {
      headers: { authorization: "Bearer " + token(user) },
    });
    const foreign = await download(userB, own.export.id);
    assert.equal(foreign.status(), 404);
    const jsonResponse = await download(userB, receipts[0].id);
    assert.equal(jsonResponse.status(), 200);
    assert.match(jsonResponse.headers()["cache-control"], /no-store/);
    const json = JSON.parse((await jsonResponse.json()).content);
    assert.equal(json.scope, "profile_and_vitals");
    assert.equal(json.profile.firstName, "OTHER-SUBJECT");
    assert.equal(json.legacyVitals[0].heartRate, 83);
    assert.doesNotMatch(JSON.stringify(json), /=QA|passwordHash|sourceKey/);
    const deletedReceipt = (await (await req(token(userA))).json()).deletion;
    assert.equal((await download(userA, deletedReceipt.id)).status(), 404);
    console.log("PASS authenticated CSV download, JSON payload, export scoping and cross-account denial");
  }
  const getReceipt = (user, id) => context.request.get(backend + routePath + "/" + id, {
    headers: { authorization: "Bearer " + token(user) },
  });
  assert.equal((await getReceipt(userB, own.export.id)).status(), 404);
  assert.deepEqual(await (await getReceipt(userA, own.export.id)).json(), own.export);
  assert.equal((await req(token(userA))).status(), 200, "requesting deletion keeps the account active");

  await page.getByRole("button", { name: "Volver al perfil" }).click();
  await openPrivacy();
  await expect(panel.getByRole("status")).toContainText(own.export.id);
  await expect(panel.getByRole("status")).toContainText("Borrado solicitado");
  await expect(panel.getByRole("status")).not.toContainText(receipts[0].id);

  if (checkFulfillment) {
    const operatorClaims = { security_stamp: "kan170-synthetic-stamp", permission: "Privacy.PublishExport" };
    const datasets = ["profile", "wellness", "vitals", "clinical", "ai", "service_logs", "audit", "archives"].map(category => ({
      category, status: category === "profile" ? "included" : "no_data", evidenceRef: "synthetic:" + category,
      records: category === "profile" ? [{ firstName: "=FULFILLMENT, QA" }] : [],
    }));
    const publish = (id, bearer, data) => context.request.put(backend + "/api/auth/privacy/fulfillment/" + id, {
      headers: { authorization: "Bearer " + bearer }, data,
    });
    const operator = token(userB, "erp", operatorClaims);
    assert.equal((await publish(own.export.id, token(userA), { userId: userA, datasets })).status(), 403);
    assert.equal((await publish(own.export.id, token(userB, "erp", { security_stamp: operatorClaims.security_stamp }), { userId: userA, datasets })).status(), 403);
    assert.equal((await publish(own.export.id, operator, { userId: userA, datasets: datasets.slice(0, -1) })).status(), 400);
    assert.equal((await publish(own.export.id, operator, { userId: userB, datasets })).status(), 404);
    assert.equal((await publish(own.export.id, operator, { userId: userA, datasets })).status(), 204);
    assert.equal((await publish(own.export.id, operator, { userId: userA, datasets })).status(), 409);
    const deliverAs = (user, id) => context.request.get(backend + routePath + "/" + id + "/full-download", {
      headers: { authorization: "Bearer " + token(user) },
    });
    assert.equal((await deliverAs(userB, own.export.id)).status(), 404);
    await page.getByRole("button", { name: "Volver al perfil" }).click();
    await openPrivacy();
    const downloaded = page.waitForEvent("download");
    await panel.getByRole("button", { name: "Descargar mi copia completa" }).click();
    const file = await downloaded;
    assert.equal(file.suggestedFilename(), "copia-de-mis-datos.csv");
    const csv = await readFile(await file.path(), "utf8");
    assert.match(csv, /'=FULFILLMENT,/);
    assert.match(csv, /archives.*no_data/);
    assert.doesNotMatch(csv, /OTHER-SUBJECT|kan170-synthetic-stamp/);
    assert.equal((await (await req(token(userA))).json()).export, null);
    assert.equal((await publish(receipts[0].id, operator, { userId: userB, datasets })).status(), 204);
    const ownJson = await deliverAs(userB, receipts[0].id);
    assert.equal(ownJson.status(), 200);
    assert.match(ownJson.headers()["cache-control"], /no-store/);
    const json = JSON.parse((await ownJson.json()).content);
    assert.equal(json.scope, "reviewed_full_copy");
    assert.equal(json.datasets.length, 8);
    console.log("PASS ERP fulfillment, complete manifest, own-account delivery and closure only on delivery");
  }

  emulateUnavailable = true;
  await page.getByRole("button", { name: "Volver al perfil" }).click();
  await openPrivacy();
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Exportar mis datos", exact: true })).toBeVisible();
  console.log("PASS Perfil → Privacidad → exportación CSV, cancelación y confirmación del borrado, comprobantes persistentes y aislados");
} finally {
  await browser.close();
}
