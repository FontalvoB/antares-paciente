import { getGatewayBaseUrl } from './apiBaseUrl'
import { ensureFreshAccessToken } from './authApi'

export function communityMediaUrl(url: string): string {
  const gateway = getGatewayBaseUrl()
  const configured = gateway || String(import.meta.env.VITE_GATEWAY_BASE_URL || '').replace(/\/+$/, '')
  const relative = configured && url.startsWith(`${configured}/storage/community/`) ? url.slice(configured.length) : url
  const path = relative.startsWith('/storage/community/')
    ? relative.replace('/storage/', '/api/v1/community/storage/') : relative
  return (path.startsWith('/storage/') || path.startsWith('/api/v1/community/storage/')) ? `${gateway}${path}` : url
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

export class CommunityMediaPreparationError extends Error {
  constructor() { super('No se pudo preparar la subida del archivo.'); this.name = 'CommunityMediaPreparationError' }
}

export class CommunityMediaUploadError extends Error {
  readonly status: number
  constructor(status: number) {
    super(`No se pudo subir el archivo (${status}).`)
    this.name = 'CommunityMediaUploadError'
    this.status = status
  }
}

export async function uploadCommunityMedia(uploadUrl: string, file: File, contentType = file.type, key?: string): Promise<void> {
  const gatewayPath = key && /^community\/(posts|avatars|covers)\/[a-zA-Z0-9._-]+$/.test(key)
    ? `/api/v1/community/storage/${key}` : undefined
  const gateway = getGatewayBaseUrl()
  const configuredGateway = gateway || String(import.meta.env.VITE_GATEWAY_BASE_URL || "").replace(/\/+$/, "")
  const legacyLocal = uploadUrl.startsWith('/storage/') || (!!configuredGateway && uploadUrl.startsWith(`${configuredGateway}/storage/`))
  const primary = legacyLocal && gatewayPath ? gatewayPath : uploadUrl
  const put = async (target: string) => {
    const url = communityMediaUrl(target)
    const authenticated = target.startsWith('/storage/') || target.startsWith('/api/v1/community/storage/') ||
      (!!gateway && url.startsWith(`${gateway}/storage/`))
    const token = authenticated ? await ensureFreshAccessToken() : null
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': contentType, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: file,
    })
    if (!response.ok) throw new CommunityMediaUploadError(response.status)
  }
  try {
    // S3 directo conserva uploads grandes y nunca recibe el token de la app.
    await put(primary)
  } catch (error) {
    // CORS/red de bucket: reintenta por el servicio autenticado, sin cambiar permisos.
    if (gatewayPath && primary !== gatewayPath && error instanceof TypeError) await put(gatewayPath)
    else throw error
  }
}
