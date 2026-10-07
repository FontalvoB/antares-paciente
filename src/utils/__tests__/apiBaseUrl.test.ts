import { afterEach, describe, expect, it, vi } from "vitest";
import { Capacitor } from "@capacitor/core";
import { getApiBaseUrl, getAuthBaseUrl, getCommunityApiUrl, getCommunityWsUrl } from "../apiBaseUrl";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("gateway: proxy web de desarrollo y conexión directa de release", () => {
  it("usa el mismo origen en web dev aunque el destino sea producción", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_GATEWAY_BASE_URL", "https://erp.coppadresd.com");
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(false);
    expect(getAuthBaseUrl()).toBe("");
    expect(getApiBaseUrl()).toBe("");
    expect(getCommunityApiUrl()).toBe("/api/v1/community/graphql");
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    expect(getCommunityWsUrl()).toBe(`${protocol}//${window.location.host}/api/v1/community/subscriptions`);
  });

  it("conserva el gateway configurado en producción web", () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_GATEWAY_BASE_URL", "https://erp.coppadresd.com/");
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(false);
    expect(getAuthBaseUrl()).toBe("https://erp.coppadresd.com");
    expect(getCommunityApiUrl()).toBe("https://erp.coppadresd.com/api/v1/community/graphql");
    expect(getCommunityWsUrl()).toBe("wss://erp.coppadresd.com/api/v1/community/subscriptions");
  });

  it("conserva el gateway directo en Capacitor incluso en desarrollo", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_GATEWAY_BASE_URL", "https://erp.coppadresd.com");
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    expect(getAuthBaseUrl()).toBe("https://erp.coppadresd.com");
  });
});
