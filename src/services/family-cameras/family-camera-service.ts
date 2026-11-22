import { apiFetch } from "../../utils/apiClient";

export const familyCameraPath = "/api/v1/family-cameras";

export interface SharedFamilyCamera {
  id: string;
  name: string;
  provider: string;
  ownerName: string;
}

export interface OwnFamilyCamera extends Omit<SharedFamilyCamera, "ownerName"> {
  sharedWithLeader: boolean;
  sharedWithAdministrators: boolean;
}

export interface FamilyCameraWorkspace {
  team: {
    id: string;
    name: string;
    isLeader: boolean;
    members: { id: string; name: string; isLeader: boolean }[];
  } | null;
  ownCameras: OwnFamilyCamera[];
  sharedCameras: SharedFamilyCamera[];
}

export interface FamilyCameraInvitation {
  code: string;
  expiresAt: string;
}

export function getFamilyCameras(expectedUserId: string, signal: AbortSignal) {
  return apiFetch<FamilyCameraWorkspace>(familyCameraPath, { signal, expectedUserId, cache: "no-store" });
}

export function getFamilyCameraFrame(cameraId: string, expectedUserId: string, signal: AbortSignal) {
  return apiFetch<{ image: string }>(`${familyCameraPath}/${cameraId}/frame`, {
    signal, expectedUserId, cache: "no-store", timeoutMs: 5000,
  });
}
