import { describe, expect, it } from "vitest";
import { sessionUserId } from "../sessionIdentity";

const claim = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier";
const token = (payload: unknown) => `header.${btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}.signature`;

describe("identidad de la sesión local", () => {
  it("recupera el identificador que emite Auth aunque /me no esté disponible", () => {
    expect(sessionUserId(token({ [claim]: "patient-a" }))).toBe("patient-a");
    expect(sessionUserId(token({ sub: "patient-b" }))).toBe("patient-b");
  });

  it("no usa correo, nombre ni identificadores inválidos como dueño de lecturas", () => {
    for (const payload of [{ email: "a@example.test" }, { sub: " " }, { sub: 42 }, null, []]) {
      expect(sessionUserId(token(payload))).toBeNull();
    }
    for (const value of [null, "demo-access-token", "a.%%%.c"]) expect(sessionUserId(value)).toBeNull();
  });
});
