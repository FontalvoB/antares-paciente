import { describe, expect, it } from "vitest";
import {
  classifyRoomEnd,
  roomEndTitleKey,
  twilioErrorCode,
  twilioErrorMessageKey,
} from "../roomEnd";

describe("classifyRoomEnd", () => {
  it("sala Ended → la consulta finalizó", () => {
    expect(
      classifyRoomEnd({ windowState: "open", roomStatus: "Ended" }),
    ).toBe("session-ended");
  });

  it("sala Expired/Failed y sesión Ended cuentan como consulta finalizada", () => {
    expect(
      classifyRoomEnd({ windowState: "open", roomStatus: "Expired" }),
    ).toBe("session-ended");
    expect(
      classifyRoomEnd({ windowState: "open", roomStatus: "Failed" }),
    ).toBe("session-ended");
    expect(
      classifyRoomEnd({ windowState: "open", activeSessionStatus: "Ended" }),
    ).toBe("session-ended");
  });

  it("cita Completed gana a la ventana cerrada", () => {
    expect(
      classifyRoomEnd({ windowState: "after", appointmentStatus: "Completed" }),
    ).toBe("session-ended");
  });

  it("fuera de ventana o cita no iniciable → ventana cerrada", () => {
    expect(
      classifyRoomEnd({ windowState: "after", appointmentStatus: "InProgress" }),
    ).toBe("window-closed");
    expect(
      classifyRoomEnd({ windowState: "open", appointmentStatus: "Cancelled" }),
    ).toBe("window-closed");
    expect(
      classifyRoomEnd({ windowState: "open", appointmentStatus: "NoShow" }),
    ).toBe("window-closed");
  });

  it("ventana abierta sin cierre de sala → red", () => {
    expect(
      classifyRoomEnd({
        windowState: "open",
        appointmentStatus: "InProgress",
        roomStatus: "Active",
        activeSessionStatus: "Active",
      }),
    ).toBe("network");
  });

  it("ventana unknown (campos aún no desplegados) no bloquea: red", () => {
    expect(
      classifyRoomEnd({ windowState: "unknown", appointmentStatus: "Confirmed" }),
    ).toBe("network");
  });

  it("sin cita ni sala conocidas → red", () => {
    expect(classifyRoomEnd({ windowState: "open" })).toBe("network");
  });
});

describe("roomEndTitleKey", () => {
  it("mapea cada causa a su copy", () => {
    expect(roomEndTitleKey("network")).toBe("Se perdió la conexión");
    expect(roomEndTitleKey("session-ended")).toBe("La consulta finalizó");
    expect(roomEndTitleKey("window-closed")).toBe(
      "La ventana de acceso a la sala ya terminó",
    );
  });
});

describe("twilioErrorCode / twilioErrorMessageKey", () => {
  it("lee .code numérico o numérico en string", () => {
    expect(twilioErrorCode({ code: 53105 })).toBe(53105);
    expect(twilioErrorCode({ code: "20101" })).toBe(20101);
    expect(twilioErrorCode({})).toBeNull();
    expect(twilioErrorCode(null)).toBeNull();
    expect(twilioErrorCode("boom")).toBeNull();
  });

  it("mapea los códigos accionables de Twilio", () => {
    expect(twilioErrorMessageKey({ code: 53105 })).toBe(
      "La sala alcanzó el máximo de participantes.",
    );
    expect(twilioErrorMessageKey({ code: 20101 })).toBe(
      "El acceso a la sala venció. Vuelve a intentarlo.",
    );
    expect(twilioErrorMessageKey({ code: 20104 })).toBe(
      "El acceso a la sala venció. Vuelve a intentarlo.",
    );
    expect(twilioErrorMessageKey({ code: 53000 })).toBe(
      "Problema de red o de cámara/micrófono. Revisa tu conexión.",
    );
    expect(twilioErrorMessageKey({ code: 53405 })).toBe(
      "Problema de red o de cámara/micrófono. Revisa tu conexión.",
    );
    expect(twilioErrorMessageKey({ code: 99999 })).toBeNull();
    expect(twilioErrorMessageKey(new Error("genérico"))).toBeNull();
  });
});
