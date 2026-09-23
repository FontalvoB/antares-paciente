import { isSkinId } from "../components/avatar/avatar-skin-catalog";
import { apiFetch, ApiError } from "../utils/apiClient";
import { getAccessToken } from "../utils/authApi";
import { getAuthBaseUrl } from "../utils/apiBaseUrl";
import { equipmentForGender } from "../components/avatar/avatar-equipment";
import type { AvatarConfiguration } from "../components/avatar/avatar-state";

const path = "/api/auth/me/avatar";
export function parseAvatarConfiguration(input: unknown): AvatarConfiguration {
  const c = input as AvatarConfiguration;
  if (
    !c ||
    c.version !== 1 ||
    !["male", "female"].includes(c.gender) ||
    !c.clothing ||
    !c.accessories
  )
    throw new Error("Invalid avatar configuration");
  const slots = [
    c.hair,
    c.clothing.shirt,
    c.clothing.pants,
    c.clothing.shoes,
    c.accessories.glasses,
    c.accessories.watch,
    c.accessories.bracelet,
  ];
  if (slots.some((id) => id !== null && typeof id !== "string"))
    throw new Error("Invalid avatar slots");
  const skin = c.skin === undefined ? "skin-03" : c.skin;
  if (!isSkinId(skin)) throw new Error("Invalid avatar skin");
  const normalized = equipmentForGender(c, c.gender);
  const accepted = [
    normalized.hair,
    ...Object.values(normalized.clothing),
    ...Object.values(normalized.accessories),
  ];
  if (slots.some((id, index) => id !== accepted[index]))
    throw new Error("Incompatible avatar item");
  return { version: 1, gender: c.gender, skin, ...normalized };
}
export async function getAvatarConfiguration(signal?: AbortSignal) {
  const value = await apiFetch<unknown>(path, { signal, cache: "no-store" });
  // Solo ausencia confirmada (200 null/204). Un 401/404/500 sigue siendo error.
  return value == null
    ? parseAvatarConfiguration({
        version: 1,
        gender: "male",
        hair: "hair-02",
        clothing: {
          shirt: "shirt-basic-01",
          pants: "pants-male-01",
          shoes: null,
        },
        accessories: { glasses: null, watch: null, bracelet: null },
      })
    : parseAvatarConfiguration(value);
}
export async function putAvatarConfiguration(
  value: AvatarConfiguration,
  signal?: AbortSignal,
) {
  // Fijar la identidad de esta escritura. No reintentar automáticamente con la
  // sesión que pueda existir después (p. ej. si se cambia de cuenta durante un 401).
  const token = getAccessToken();
  if (!token) throw new ApiError({ status: 401, message: "Session required" });
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(cancel, 15000);
  try {
    const response = await fetch(`${getAuthBaseUrl()}${path}`, {
      method: "PUT",
      credentials: "include",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(parseAvatarConfiguration(value)),
      signal: controller.signal,
    });
    if (!response.ok)
      throw new ApiError({
        status: response.status,
        message: "Avatar save failed",
      });
    return parseAvatarConfiguration(await response.json());
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
  }
}
