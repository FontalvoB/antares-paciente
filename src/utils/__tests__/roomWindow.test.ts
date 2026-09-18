import { describe, expect, it } from "vitest";
import { formatRoomMoment, roomWindowState } from "../roomWindow";

const OPEN = "2026-09-18T14:00:00.000Z";
const CLOSE = "2026-09-18T15:00:00.000Z";
const OPEN_MS = new Date(OPEN).getTime();
const CLOSE_MS = new Date(CLOSE).getTime();

describe("roomWindowState — ventana de acceso a la sala", () => {
  it("sin fechas → unknown (la UI no bloquea la entrada)", () => {
    expect(roomWindowState(OPEN_MS, null, null)).toBe("unknown");
    expect(roomWindowState(OPEN_MS, undefined, undefined)).toBe("unknown");
    expect(roomWindowState(OPEN_MS, "", "")).toBe("unknown");
  });

  it("fechas inválidas → unknown", () => {
    expect(roomWindowState(OPEN_MS, "no-es-fecha", "tampoco")).toBe("unknown");
  });

  it("antes de abrir → before", () => {
    expect(roomWindowState(OPEN_MS - 1, OPEN, CLOSE)).toBe("before");
  });

  it("justo al abrir → open", () => {
    expect(roomWindowState(OPEN_MS, OPEN, CLOSE)).toBe("open");
  });

  it("dentro de la ventana → open", () => {
    expect(roomWindowState((OPEN_MS + CLOSE_MS) / 2, OPEN, CLOSE)).toBe("open");
  });

  it("justo al cerrar → after (límite exclusivo)", () => {
    expect(roomWindowState(CLOSE_MS, OPEN, CLOSE)).toBe("after");
  });

  it("después de cerrar → after", () => {
    expect(roomWindowState(CLOSE_MS + 1, OPEN, CLOSE)).toBe("after");
  });

  it("solo roomClosesAt: abierto antes, cerrado después", () => {
    expect(roomWindowState(CLOSE_MS - 1, null, CLOSE)).toBe("open");
    expect(roomWindowState(CLOSE_MS, null, CLOSE)).toBe("after");
  });

  it("solo roomOpensAt: before hasta abrir, open después", () => {
    expect(roomWindowState(OPEN_MS - 1, OPEN, null)).toBe("before");
    expect(roomWindowState(OPEN_MS, OPEN, null)).toBe("open");
  });

  it("acepta Date además de epoch ms", () => {
    expect(roomWindowState(new Date(OPEN_MS - 1), OPEN, CLOSE)).toBe("before");
    expect(roomWindowState(new Date(OPEN_MS), OPEN, CLOSE)).toBe("open");
  });
});

describe("formatRoomMoment — fecha corta local para avisos", () => {
  it("formatea una fecha ISO con locale es-ES", () => {
    const text = formatRoomMoment(OPEN, "es-ES");
    expect(text).toMatch(/\d{1,2}\/\d{1,2}/);
    expect(text).toMatch(/\d{2}:\d{2}/);
  });

  it("devuelve cadena vacía sin dato o con fecha inválida", () => {
    expect(formatRoomMoment(null, "es-ES")).toBe("");
    expect(formatRoomMoment(undefined, "es-ES")).toBe("");
    expect(formatRoomMoment("no-es-fecha", "es-ES")).toBe("");
  });
});
