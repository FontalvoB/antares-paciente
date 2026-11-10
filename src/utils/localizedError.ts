import { isLegalConsentError, legalConsentMessage } from "./legalConsents";

export const CONTENT_TRANSLATION_RETRY_SOURCE = "No pudimos preparar este contenido en inglés. Vuelve a intentarlo.";

type Translator = (source: string, params?: Record<string, string>) => string;

interface ErrorLanguage {
  lang: "es" | "en";
  t: Translator;
}

/** Presenta errores conocidos sin exponer mensajes técnicos ni texto libre al usuario. */
export function localizedError(error: unknown, { t, lang }: ErrorLanguage, fallback: string): string {
  if (isLegalConsentError(error)) return t(legalConsentMessage(error));
  const detail = error && typeof error === "object" ? error as {
    message?: unknown;
    code?: unknown;
    errors?: Record<string, unknown>;
  } : null;
  if (detail?.code === "CONTENT_TRANSLATION_UNAVAILABLE"
    || (typeof detail?.message === "string" && detail.message.startsWith("CONTENT_TRANSLATION_UNAVAILABLE:")))
    return t("No pudimos preparar este contenido en inglés. Vuelve a intentarlo.");
  const validation = Object.values(detail?.errors ?? {}).flat().filter((value): value is string => typeof value === "string");
  const messages = validation.length ? validation : typeof error === "string" ? [error] : typeof detail?.message === "string" ? [detail.message] : [];
  const translated = messages.map(message => {
    // Los códigos de dominio son metadatos; el mensaje sigue siendo la clave del catálogo.
    const source = message.replace(/^[A-Z][A-Z_]+:\s*/, "").trim();
    if (!source || /^(HTTP\s*\d+|Failed to fetch|NetworkError|Load failed|The operation was aborted|HealthTests API error)/i.test(source)) return null;
    const localized = t(source);
    if (localized !== source) return localized;
    // En español conservamos el detalle de negocio del servidor. En inglés,
    // los mensajes nuevos necesitan una traducción explícita del catálogo.
    return lang === "es" ? source : null;
  }).filter((message): message is string => message !== null);
  return translated.length ? [...new Set(translated)].join(" · ") : t(fallback);
}
