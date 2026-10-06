import { afterEach, describe, expect, it, vi } from "vitest";
import { openNativeDialer, sanitizePhoneNumber } from "../nativeDialer";

describe("sanitizePhoneNumber", () => {
  it("conserva el prefijo internacional y descarta el formato", () => {
    expect(sanitizePhoneNumber("+57 304 618 7603")).toBe("+573046187603");
    expect(sanitizePhoneNumber("(786) 555-0192")).toBe("7865550192");
  });

  it("limpia espacios y devuelve vacío sin dígitos", () => {
    expect(sanitizePhoneNumber(" 911 ")).toBe("911");
    expect(sanitizePhoneNumber("")).toBe("");
    expect(sanitizePhoneNumber(null)).toBe("");
    expect(sanitizePhoneNumber(undefined)).toBe("");
    expect(sanitizePhoneNumber("abc")).toBe("");
  });
});

describe("openNativeDialer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("navega a tel: con el número saneado", () => {
    const assign = vi
      .spyOn(window.location, "assign")
      .mockImplementation(() => undefined);
    expect(openNativeDialer("+57 304 618 7603")).toBe(true);
    expect(assign).toHaveBeenCalledWith("tel:+573046187603");
  });

  it("no navega ni devuelve true sin número utilizable", () => {
    const assign = vi
      .spyOn(window.location, "assign")
      .mockImplementation(() => undefined);
    expect(openNativeDialer("")).toBe(false);
    expect(openNativeDialer(null)).toBe(false);
    expect(assign).not.toHaveBeenCalled();
  });
});
