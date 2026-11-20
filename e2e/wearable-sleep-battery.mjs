import { chromium, expect } from 'playwright/test';
import { randomUUID } from 'node:crypto';
import {
  BC_SLEEP, BC_SPO2, CMD, COLMI_SERVICE, COLMI_CHAR_RX, COLMI_CHAR_TX,
  COLMI_BC_SERVICE, COLMI_BC_WRITE, COLMI_BC_NOTIFY, bcFrame, buildFrame,
} from '../src/devices/colmi/protocol.ts';
import {
  OP, YCBT_SERVICE, YCBT_CHAR_C1, YCBT_CHAR_C3, buildPacket,
} from '../src/devices/ycbt/protocol.ts';

// Only the radio and backend are simulated. The app connects through its
// regular Web Bluetooth client and handles the same GATT bytes as on a phone.
const bytes = frame => Array.from(frame);
const endHistory = [CMD.STEPS, CMD.HR_HISTORY, CMD.STRESS_HISTORY, CMD.HRV_HISTORY]
  .map(cmd => [cmd, bytes(buildFrame(cmd, [0xff, 0, 0]))]);
const hrCurve = [
  bytes(buildFrame(CMD.HR_HISTORY, [0, 3])),
  bytes(buildFrame(CMD.HR_HISTORY, [1, 0, 0, 0, 0, 70, 71, 72, 73, 74, 75])),
];
// 23:00–06:40, including 20 minutes awake. Today's HR series cannot
// corroborate this older recording. The same blob can model a current night.
const sleepFrame = day => bytes(bcFrame(BC_SLEEP, Uint8Array.from([
  1, day, 0, 0x64, 0x05, 0x90, 0x01,
  2, 180, 3, 120, 5, 20, 4, 140,
])));

const browser = await chromium.launch();
const failures = [];

for (const scenario of ['previous-night', 'current-night', 'no-sleep', 'H59-battery', 'R88-battery']) {
  if (process.env.COP_E2E_CASE && scenario !== process.env.COP_E2E_CASE) continue;
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    timezoneId: 'America/Bogota',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  if (process.env.COP_E2E_DEBUG) {
    page.on('console', message => console.log(message.text()));
    page.on('pageerror', console.error);
  }
  const clockStart = new Date('2026-11-20T17:00:00Z');
  await page.clock.install({ time: clockStart });
  const accountId = randomUUID();
  const patientId = randomUUID();
  const token = 'x.' + Buffer.from(JSON.stringify({
    sub: accountId, exp: Math.floor(clockStart.getTime() / 1000) + 3600,
  })).toString('base64url') + '.x';

  await context.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const reply = json => route.fulfill({ json });
    if (path === '/api/auth/refresh') return reply({ accessToken: token, expiresIn: 3600 });
    if (path === '/api/auth/me') return reply({ id: accountId, firstName: 'Lucía', lastName: 'QA', roles: ['Patient'], permissions: [] });
    if (path === '/api/v1/me/patient-profile') return reply({
      patientId, firstName: 'Lucía', lastName: 'QA', documentNumber: 'QA',
      emergencyContact: { name: 'QA Contacto', phone: '+573000000001' },
    });
    if (path.endsWith('/health-tests/me/assignments') || path.endsWith('/health-tests/me/results')) return reply([]);
    if (path.endsWith('/program/notifications')) return reply({ items: [], unreadCount: 0, totalCount: 0 });
    return route.fulfill({ status: 404, json: {} });
  });

  const ring = scenario === 'R88-battery';
  const batteryFrames = [99, 61, 82, 255, 0].map((level, index) => ring
    ? bytes(buildPacket(OP.GET_DEVICE_INFO, [0, 0, 13, 1, 0, level]))
    : bytes(buildFrame(CMD.BATTERY, [level, index === 2 ? 1 : 0])));
  const night = scenario === 'previous-night' ? sleepFrame(1)
    : scenario === 'current-night' ? sleepFrame(0)
    : bytes(bcFrame(BC_SLEEP, Uint8Array.of(0)));
  await context.addInitScript(({
    model, primaryService, commandChar, notifyChar, richService, richWrite, richNotify,
    batteryFrames, batteryCommand, endHistory, hrCurve, night, spo2,
  }) => {
    localStorage.setItem('antares_lang', 'es');
    const device = new EventTarget();
    Object.assign(device, { id: 'wearable-qa', name: model });
    const services = new Map();
    const radio = { batteryIndex: 0, sleeps: 0 };
    window.wearableFixture = radio;

    function service(uuid, chars) {
      const entry = { uuid, device };
      const characteristics = new Map(chars.map(charUuid => {
        const char = new EventTarget();
        Object.assign(char, {
          uuid: charUuid, service: entry, properties: {},
          startNotifications: async () => char,
          stopNotifications: async () => char,
          writeValueWithResponse: async data => handleWrite(charUuid, new Uint8Array(data.buffer, data.byteOffset, data.byteLength)),
          writeValueWithoutResponse: async data => handleWrite(charUuid, new Uint8Array(data.buffer, data.byteOffset, data.byteLength)),
        });
        return [charUuid, char];
      }));
      entry.getCharacteristics = async () => [...characteristics.values()];
      entry.getCharacteristic = async charUuid => characteristics.get(charUuid);
      services.set(uuid, entry);
    }

    async function notify(serviceUuid, charUuid, frame) {
      const target = await services.get(serviceUuid).getCharacteristic(charUuid);
      target.value = new DataView(Uint8Array.from(frame).buffer);
      target.dispatchEvent(new Event('characteristicvaluechanged'));
    }

    async function handleWrite(uuid, data) {
      if (uuid === commandChar) {
        if (batteryCommand.every((byte, index) => data[index] === byte)) {
          await notify(primaryService, model === 'R88' ? commandChar : notifyChar, batteryFrames[radio.batteryIndex]);
        }
        if (model === 'H59') {
          const end = endHistory.find(([cmd]) => cmd === data[0]);
          if (endHistory[1][0] === data[0]) {
            for (const frame of hrCurve) await notify(primaryService, notifyChar, frame);
          }
          if (end) await notify(primaryService, notifyChar, end[1]);
        }
      }
      if (uuid === richWrite && data[1] === night[1]) {
        radio.sleeps++;
        await notify(richService, richNotify, night.slice(0, 8));
        await notify(richService, richNotify, night.slice(8));
      }
      if (uuid === richWrite && data[1] === spo2[1]) await notify(richService, richNotify, spo2);
    }

    service(primaryService, [commandChar, notifyChar]);
    if (model === 'H59') service(richService, [richWrite, richNotify]);
    device.gatt = {
      connect: async () => device.gatt,
      disconnect: () => {},
      getPrimaryServices: async () => [...services.values()],
      getPrimaryService: async uuid => services.get(uuid),
    };
    Object.defineProperty(navigator, 'bluetooth', {
      value: { getAvailability: async () => true, requestDevice: async () => device },
    });
  }, {
    model: ring ? 'R88' : 'H59',
    primaryService: ring ? YCBT_SERVICE : COLMI_SERVICE,
    commandChar: ring ? YCBT_CHAR_C1 : COLMI_CHAR_RX,
    notifyChar: ring ? YCBT_CHAR_C3 : COLMI_CHAR_TX,
    richService: COLMI_BC_SERVICE, richWrite: COLMI_BC_WRITE, richNotify: COLMI_BC_NOTIFY,
    batteryFrames, batteryCommand: ring ? [0x02, 0] : [CMD.BATTERY],
    endHistory, hrCurve: scenario === 'current-night' ? [
      bytes(buildFrame(CMD.HR_HISTORY, [0, 3])),
      bytes(buildFrame(CMD.HR_HISTORY, [2, 70, 71, 72, 73, 74, 75])),
    ] : hrCurve, night,
    spo2: bytes(bcFrame(BC_SPO2, new Uint8Array(49))),
  });

  try {
    await page.goto(process.env.COP_E2E_APP_URL ?? 'http://localhost:5188');
    await page.locator('.hm-quick').getByRole('button', { name: 'Conectar', exact: true }).click();
    await page.getByRole('button', { name: 'Buscar dispositivo' }).click();
    await page.locator('ion-item.group-item').filter({ has: page.getByRole('heading', { name: ring ? 'R88' : 'H59', exact: true }) }).click();
    await expect(page.locator('.wearable-battery')).toHaveText('99%', { timeout: 12000 });

    if (scenario.endsWith('-battery')) {
      const badge = page.locator('.wearable-battery');
      const icon = badge.locator('ion-icon');
      await expect(icon).toHaveAccessibleName('Batería');
      let previousIcon = await icon.evaluate(element => element.icon);
      for (const [index, level] of [[1, 61], [2, 82], [3, 82], [4, 0]]) {
        await page.evaluate(value => { window.wearableFixture.batteryIndex = value; }, index);
        await page.clock.runFor(130_000);
        await expect(badge).toHaveText(`${level}%`);
        const iconName = !ring && (index === 2 || index === 3) ? 'Batería cargando' : 'Batería';
        await expect(icon).toHaveAccessibleName(iconName);
        const currentIcon = await icon.evaluate(element => element.icon);
        if (index === 3) expect(currentIcon).toBe(previousIcon);
        else expect(currentIcon).not.toBe(previousIcon);
        previousIcon = currentIcon;
        await expect(page.locator('.watch-batt')).toHaveText(`${level}%`);
      }
    } else {
      await expect.poll(() => page.evaluate(() => window.wearableFixture.sleeps)).toBeGreaterThan(0);
      const summary = page.locator('.wearable-summary-item').filter({ hasText: 'Sueño' });
      const details = page.locator('.watch-metric--sleep');
      if (scenario === 'previous-night') {
        await expect(summary).toContainText('7 h 20 min');
        await expect(summary).toContainText('19/11/2026');
        await expect(details).toContainText('19/11/2026');
        const snapshot = await page.evaluate(() => JSON.parse(localStorage.getItem(
          Object.keys(localStorage).find(key => key.startsWith('antares_wearable_samples:v1:')),
        )));
        expect(snapshot.latest.sleep.value).toBe(440);
        expect(snapshot.days['2026-11-20'].sleep).toBeNull();
      } else if (scenario === 'current-night') {
        await expect(summary).toContainText('7 h 20 min');
        await expect(details).toContainText('Última noche');
      } else {
        await expect(summary.locator('strong')).toHaveText('—');
        await expect(details).toContainText('Sin datos aún');
      }
    }
    console.log(`PASS ${scenario}`);
  } catch (error) {
    if (process.env.COP_E2E_DEBUG) console.log(await page.locator('body').innerText());
    failures.push(scenario);
    console.error(`FAIL ${scenario}\n${error.stack}`);
  } finally {
    await context.close();
  }
}
await browser.close();
if (failures.length) process.exitCode = 1;
