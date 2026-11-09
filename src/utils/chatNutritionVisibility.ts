/** KAN-52: visibilidad del chat, independiente del módulo dedicado de Nutrición. */
export const CHAT_NUTRITION_ENABLED =
  import.meta.env.VITE_CHAT_NUTRITION_ENABLED === "true";

/** Reconoce destinos del módulo incluso en query/hash o con escapes de URL. */
function isNutritionDestination(href: string): boolean {
  let decoded = href;
  for (let pass = 0; pass < 2; pass += 1) {
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      break;
    }
  }
  return /(?:^|[/?#=&])(?:nutrition|nutrici[oó]n|nut|program-nut|food[-_]?ai)(?=$|[/?#=&_-])/i.test(
    decoded.replace(/[.,;!?)]+$/, ""),
  );
}

/** No muta mensajes persistidos ni impide conversar sobre alimentación. */
export function chatTextForDisplay(text: string): string {
  if (CHAT_NUTRITION_ENABLED) return text;
  return text
    .replace(/\[([^\]]+)\]\(([^\s)]+)\)/g, (link, label: string, href: string) =>
      isNutritionDestination(href) || !canShowChatAction("", label) ? label : link,
    )
    .replace(/https?:\/\/[^\s<>]+/g, (href) =>
      isNutritionDestination(href) ? "" : href,
    );
}

/** Protege también los botones sugeridos por versiones anteriores del servicio. */
export function canShowChatAction(type: string, label: string): boolean {
  return CHAT_NUTRITION_ENABLED || !/\b(?:nutrition|nutrici[oó]n|nutricional|nutritional|food[-_ ]?ai|plan alimentario|meal plan)\b/i.test(
    `${type.replace(/[_-]/g, " ")} ${label}`,
  );
}
