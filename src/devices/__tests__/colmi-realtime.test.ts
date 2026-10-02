import { describe, expect, it } from "vitest";
import {
  buildFrame,
  CMD_REALTIME_RESPONSE,
  parseFrame,
} from "../colmi/protocol";
import { parseRealtimeFrame } from "../colmi/realtime";
import type { ColmiFrame } from "../colmi/protocol";

const DEVICE = "band-1";

/** Trama en vivo válida a partir de su payload de 14 B. */
function frame(payload: number[]): ColmiFrame {
  const parsed = parseFrame(buildFrame(CMD_REALTIME_RESPONSE, payload));
  if (!parsed) throw new Error("trama inválida");
  return parsed;
}

const zeros = (count: number) => new Array(count).fill(0);

describe("parseRealtimeFrame — FC", () => {
  it("lee el layout clásico (valor en payload[2])", () => {
    const samples = parseRealtimeFrame(frame([1, 0, 66, ...zeros(11)]), DEVICE);
    expect(samples[0]).toMatchObject({ metric: "heart_rate", value: 66 });
  });

  // Captura real del H59: `69 01 00 00 00 00 93 02 …` → u16 0x0293 = 659 → 65.9 lpm.
  it("lee el layout u16 en décimas del firmware H59", () => {
    const samples = parseRealtimeFrame(
      frame([1, 0, 0, 0, 0, 0x93, 0x02, ...zeros(7)]),
      DEVICE,
    );
    expect(samples[0]).toMatchObject({ metric: "heart_rate", value: 66 });
  });

  it("descarta el ack sin lectura (todo en cero)", () => {
    expect(parseRealtimeFrame(frame([1, 0, ...zeros(12)]), DEVICE)).toEqual([]);
  });

  it("descarta un u16 fuera del rango humano", () => {
    expect(
      parseRealtimeFrame(
        frame([1, 0, 0, 0, 0, 0xff, 0xff, ...zeros(7)]),
        DEVICE,
      ),
    ).toEqual([]);
    expect(
      parseRealtimeFrame(
        frame([1, 0, 0, 0, 0, 0x01, 0x00, ...zeros(7)]),
        DEVICE,
      ),
    ).toEqual([]);
  });

  it("la presión conserva su layout (sistólica/diastólica + FC)", () => {
    const samples = parseRealtimeFrame(
      frame([2, 0, 66, 125, 76, ...zeros(9)]),
      DEVICE,
    );
    expect(samples[0]).toMatchObject({
      metric: "blood_pressure",
      value: 125,
      value2: 76,
    });
    expect(samples[1]).toMatchObject({ metric: "heart_rate", value: 66 });
  });

  it("la presión acepta el layout u16 en décimas", () => {
    // 1180 / 760 en payload[5..6] y payload[7..8] → 118/76.
    const samples = parseRealtimeFrame(
      frame([2, 0, 0, 0, 0, 0x9c, 0x04, 0xf8, 0x02, ...zeros(5)]),
      DEVICE,
    );
    expect(samples[0]).toMatchObject({
      metric: "blood_pressure",
      value: 118,
      value2: 76,
    });
  });

  it("la presión acepta el layout u16 entero (sin décimas)", () => {
    const samples = parseRealtimeFrame(
      frame([2, 0, 0, 0, 0, 118, 0, 76, 0, ...zeros(5)]),
      DEVICE,
    );
    expect(samples[0]).toMatchObject({
      metric: "blood_pressure",
      value: 118,
      value2: 76,
    });
  });

  it("descarta una presión imposible", () => {
    expect(
      parseRealtimeFrame(
        frame([2, 0, 0, 0, 0, 20, 0, 10, 0, ...zeros(5)]),
        DEVICE,
      ),
    ).toEqual([]);
    expect(
      parseRealtimeFrame(frame([2, 0, 66, 76, 125, ...zeros(9)]), DEVICE),
    ).toEqual([]);
  });

  it("el SpO2 conserva su layout (valor en payload[2])", () => {
    const samples = parseRealtimeFrame(frame([3, 0, 98, ...zeros(11)]), DEVICE);
    expect(samples[0]).toMatchObject({ metric: "spo2", value: 98 });
  });

  it("el SpO2 ignora el layout en décimas (eco de estado, no medición)", () => {
    // Los bytes 5–6 llevan un campo constante del firmware (`27 03`/`79 02`
    // idéntico en tramas de FC, SpO2 y presión): aceptarlo cerraba barridos
    // en 1.6 s con 63–81 % inventados. Solo vale el byte clásico.
    expect(
      parseRealtimeFrame(
        frame([3, 0, 0, 0, 0, 0xda, 0x03, ...zeros(7)]),
        DEVICE,
      ),
    ).toEqual([]);
    expect(
      parseRealtimeFrame(
        frame([3, 0, 0, 0, 0, 0x27, 0x03, ...zeros(7)]),
        DEVICE,
      ),
    ).toEqual([]);
  });

  it("descarta un SpO2 en décimas imposible", () => {
    expect(
      parseRealtimeFrame(
        frame([3, 0, 0, 0, 0, 0x10, 0x00, ...zeros(7)]),
        DEVICE,
      ),
    ).toEqual([]);
  });

  it("descarta un SpO2 bajo aunque el crudo pase (fantasma `79 02` → 63 %)", () => {
    // Captura real: campo constante `79 02` en cada trama = 633 crudo = 63 %.
    // Sin gate final el barrido cerraba en 1.6 s con basura.
    expect(
      parseRealtimeFrame(
        frame([3, 0, 0, 0, 0, 0x79, 0x02, ...zeros(7)]),
        DEVICE,
      ),
    ).toEqual([]);
    expect(parseRealtimeFrame(frame([3, 0, 65, ...zeros(11)]), DEVICE)).toEqual(
      [],
    );
  });

  it("descarta una FC clásica fuera del rango humano", () => {
    expect(
      parseRealtimeFrame(frame([1, 0, 250, ...zeros(11)]), DEVICE),
    ).toEqual([]);
    expect(parseRealtimeFrame(frame([1, 0, 25, ...zeros(11)]), DEVICE)).toEqual(
      [],
    );
  });
});
