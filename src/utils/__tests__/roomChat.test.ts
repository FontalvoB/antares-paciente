import { describe, expect, it } from "vitest";
import type { ChatMessageDto } from "../appointmentsApi";
import {
  isRoomChatEnabled,
  mergeRoomChatMessages,
  roomChatCursor,
  type RoomChatMessage,
} from "../roomChat";

function msg(id: string, createdAt: string, body = id): ChatMessageDto {
  return {
    id,
    appointmentId: "appt-1",
    senderUserId: id === "p1" ? "patient" : "pro",
    senderRole: id === "p1" ? "Patient" : "Professional",
    body,
    createdAt,
  };
}

function pending(id: string, createdAt: string, body = id): RoomChatMessage {
  return { ...msg(id, createdAt, body), pending: true };
}

describe("mergeRoomChatMessages", () => {
  it("ordena por (createdAt, id)", () => {
    const merged = mergeRoomChatMessages(
      [msg("b", "2026-09-18T14:00:02Z")],
      [msg("a", "2026-09-18T14:00:01Z"), msg("c", "2026-09-18T14:00:03Z")],
    );
    expect(merged.map((m) => m.id)).toEqual(["a", "b", "c"]);
  });

  it("deduplica por id y el lote del servidor pisa la copia local", () => {
    const merged = mergeRoomChatMessages(
      [msg("a", "2026-09-18T14:00:01Z", "viejo")],
      [
        msg("a", "2026-09-18T14:00:01Z", "nuevo"),
        msg("a", "2026-09-18T14:00:01Z", "nuevo"),
      ],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].body).toBe("nuevo");
  });

  it("con empate de fecha ordena por id", () => {
    const merged = mergeRoomChatMessages(
      [],
      [msg("z", "2026-09-18T14:00:01Z"), msg("a", "2026-09-18T14:00:01Z")],
    );
    expect(merged.map((m) => m.id)).toEqual(["a", "z"]);
  });

  it("conserva los pendientes al final y en orden de envío", () => {
    const merged = mergeRoomChatMessages(
      [pending("local-1", "2026-09-18T14:00:05Z"), msg("a", "2026-09-18T14:00:01Z")],
      [msg("b", "2026-09-18T14:00:06Z")],
    );
    expect(merged.map((m) => m.id)).toEqual(["a", "b", "local-1"]);
    expect(merged[2].pending).toBe(true);
  });

  it("no pierde el fallo marcado al fusionar", () => {
    const failed: RoomChatMessage = {
      ...pending("local-1", "2026-09-18T14:00:05Z"),
      failed: true,
    };
    const merged = mergeRoomChatMessages([failed], []);
    expect(merged[0].failed).toBe(true);
  });
});

describe("roomChatCursor", () => {
  it("null sin historial real (solo pendientes)", () => {
    expect(roomChatCursor([])).toBeNull();
    expect(roomChatCursor([pending("local-1", "2026-09-18T14:00:05Z")])).toBeNull();
  });

  it("devuelve el último (createdAt, id) del servidor", () => {
    expect(
      roomChatCursor([
        msg("a", "2026-09-18T14:00:01Z"),
        msg("c", "2026-09-18T14:00:03Z"),
        msg("b", "2026-09-18T14:00:02Z"),
      ]),
    ).toEqual({ after: "2026-09-18T14:00:03Z", afterId: "c" });
  });

  it("ignora fechas inválidas del último mensaje", () => {
    expect(roomChatCursor([msg("a", "no-es-fecha")])).toBeNull();
  });
});

describe("isRoomChatEnabled", () => {
  it("habilitado con la cita Confirmed, InProgress o Completed", () => {
    expect(isRoomChatEnabled("Confirmed")).toBe(true);
    expect(isRoomChatEnabled("InProgress")).toBe(true);
    expect(isRoomChatEnabled("Completed")).toBe(true);
  });

  it("deshabilitado fuera de esos estados", () => {
    expect(isRoomChatEnabled("Cancelled")).toBe(false);
    expect(isRoomChatEnabled("NoShow")).toBe(false);
    expect(isRoomChatEnabled("Requested")).toBe(false);
    expect(isRoomChatEnabled(undefined)).toBe(false);
  });
});
