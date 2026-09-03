import { getAccessToken } from "./authApi";
import { getGatewayBaseUrl } from "./apiBaseUrl";

// ── Types mirroring the backend contract ───────────────────────────────

export type SosDispatchStatus = "Sent" | "Partial" | "Failed" | "Disabled";
export type SosChannelStatus =
  | "Sent"
  | "Failed"
  | "Disabled"
  | "Skipped";

export interface SosChannelResult {
  status: SosChannelStatus;
  detail?: string;
}

export interface SosDispatchResult {
  id: string;
  status: SosDispatchStatus;
  triggeredAt: string;
  messageText: string;
  emergencyNumber: string;
  channels: {
    sms: SosChannelResult;
    email: SosChannelResult;
    voice: SosChannelResult;
  };
}

export interface SosAlertPayload {
  latitude?: number | null;
  longitude?: number | null;
  accuracyMeters?: number | null;
  locationLabel?: string | null;
  vitals?: {
    heartRate?: number | null;
    spo2?: number | null;
    bloodPressure?: string | null;
  } | null;
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
    email: string;
  } | null;
  language?: "es" | "en";
}

// ── API call ───────────────────────────────────────────────────────────

/**
 * Raw backend response: sms/email/voice are top-level properties
 * (SosAlertResult en el backend), no anidados bajo `channels`.
 */
interface SosDispatchRaw {
  id: string;
  status: SosDispatchStatus;
  triggeredAt: string;
  messageText: string;
  emergencyNumber: string;
  sms: SosChannelResult;
  email: SosChannelResult;
  voice: SosChannelResult;
}

/**
 * Sends the SOS alert to the backend.
 * NEVER throws — returns null on missing token or any error.
 */
export async function activateSosAlert(
  payload: SosAlertPayload,
): Promise<SosDispatchResult | null> {
  const token = getAccessToken();
  if (!token) return null;
  try {
    const res = await fetch(`${getGatewayBaseUrl()}/api/v1/sos/alerts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const raw = (await res.json()) as SosDispatchRaw;
    return {
      id: raw.id,
      status: raw.status,
      triggeredAt: raw.triggeredAt,
      messageText: raw.messageText,
      emergencyNumber: raw.emergencyNumber,
      channels: {
        sms: raw.sms,
        email: raw.email,
        voice: raw.voice,
      },
    };
  } catch {
    return null;
  }
}
