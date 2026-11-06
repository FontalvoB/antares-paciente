import { describe, expect, it } from "vitest";
import en from "../../i18n/en.json";
import { localizedError } from "../localizedError";

const english = {
  lang: "en" as const,
  t: (source: string) => (en as Record<string, string>)[source] ?? source,
};
const spanish = { lang: "es" as const, t: (source: string) => source };

describe("localized operation errors", () => {
  it("translates authentication errors from the actual backend", () => {
    expect(localizedError(new Error("Credenciales inválidas"), english, "Error al iniciar sesión")).toBe("Invalid credentials");
  });
  it("prioritizes and translates validation details instead of a technical title", () => {
    expect(localizedError({ message: "HTTP 400", errors: { nickname: ["Ese apodo no está disponible."] } }, english, "No pudimos guardar tus preferencias.")).toBe("That nickname is unavailable.");
  });
  it("translates domain errors with canonical code prefixes", () => {
    expect(localizedError(new Error("FUTURE_MEASUREMENT_DATE: no se permite una fecha futura."), english, "No se pudo guardar el peso.")).toBe("Future dates are not allowed.");
  });
  it("keeps Spanish business details available and uses a translated recovery message for unknown English errors", () => {
    const error = new Error("Regla nueva del servidor");
    expect(localizedError(error, spanish, "No se pudo guardar el peso.")).toBe("Regla nueva del servidor");
    expect(localizedError(error, english, "No se pudo guardar el peso.")).toBe(english.t("No se pudo guardar el peso."));
  });
  it("explains a translation outage and invites retry in the selected language", () => {
    const error = { code: "CONTENT_TRANSLATION_UNAVAILABLE", message: "English content could not be prepared. Please try again." };
    expect(localizedError(error, english, "Error al iniciar sesión")).toBe("We couldn't prepare this content in English. Please try again.");
    expect(localizedError(error, spanish, "Error al iniciar sesión")).toBe("No pudimos preparar este contenido en inglés. Vuelve a intentarlo.");
  });
  it("does not expose HTTP internals or network exceptions", () => {
    expect(localizedError(new Error("Failed to fetch"), english, "Error al iniciar sesión")).toBe(english.t("Error al iniciar sesión"));
    expect(localizedError(new Error("HTTP 500"), spanish, "Error al iniciar sesión")).toBe("Error al iniciar sesión");
  });
});
