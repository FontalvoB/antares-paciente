import { getGatewayBaseUrl } from './apiBaseUrl'
import { ensureFreshAccessToken } from './authApi'

export function communityMediaUrl(url: string): string {
  return url.startsWith('/storage/') ? `${getGatewayBaseUrl()}${url}` : url
}

/** Normalize only known storage fields, preserving external/signed URLs exactly. */
export function resolveCommunityMedia<T>(data: T): T {
  if (Array.isArray(data)) return data.map(resolveCommunityMedia) as T
  if (!data || typeof data !== 'object') return data
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key,
    ['imageUrl', 'avatarUrl', 'coverUrl', 'logoUrl', 'readUrl'].includes(key) && typeof value === 'string'
      ? communityMediaUrl(value) : resolveCommunityMedia(value),
  ])) as T
}

export class CommunityMediaUploadError extends Error {
  readonly status: number
  constructor(status: number) {
    super(`No se pudo subir la imagen (${status}).`)
    this.name = 'CommunityMediaUploadError'
    this.status = status
  }
}

export async function uploadCommunityMedia(uploadUrl: string, file: File, contentType = file.type): Promise<void> {
  const url = communityMediaUrl(uploadUrl)
  // Signed cloud URLs already authorize the upload; never forward the app token to them.
  const localStorage = uploadUrl.startsWith('/storage/') ||
    (getGatewayBaseUrl() && url.startsWith(`${getGatewayBaseUrl()}/storage/`))
  const token = localStorage ? await ensureFreshAccessToken() : null
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: file,
  })
  if (!response.ok) throw new CommunityMediaUploadError(response.status)
}
