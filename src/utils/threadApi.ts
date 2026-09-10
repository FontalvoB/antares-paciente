import { getAccessToken } from './authApi'
import { getApiBaseUrl } from './apiBaseUrl'
import type { ChatSuggestion } from '../types'

/** Resumen del historial de un thread devuelto por el backend .NET (proxy → AI Service). */
export interface ThreadState {
  threadId: string
  messageCount: number
  lastMessage: string | null
}

/**
 * Lee el estado del thread estable del paciente vía el backend .NET
 * (GET /api/v1/threads/{threadId}/messages). El frontend NUNCA llama al
 * AI Service directo: el backend hace de puente (X-Internal-Key vive solo
 * allí). Devuelve null si el thread no existe, el backend falla o la
 * respuesta no es parseable (degradación a chat vacío, nunca romper).
 */
export async function fetchThreadState(threadId: string, userId: string): Promise<ThreadState | null> {
  try {
    const accessToken = getAccessToken()
    const url = `${getApiBaseUrl()}/api/v1/threads/${encodeURIComponent(threadId)}/messages?userId=${encodeURIComponent(userId)}`
    const res = await fetch(url, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    })
    if (!res.ok) return null
    const data = (await res.json()) as ThreadState
    return data
  } catch (error) {
    console.warn('[thread] No se pudo cargar el historial del thread:', error)
    return null
  }
}

export interface ChatResult {
  reply: string
  threadId: string
  executionId?: string
  agent?: string
  /** Sugerencias de acción del bot (v1: appointment CTA). Ausente = sin sugerencia. */
  suggestions?: ChatSuggestion[] | null
}

/**
 * Envía un mensaje de chat al backend .NET (POST /api/v1/chat).
 * El backend inyecta la identidad del usuario desde el JWT y delega
 * la ejecución al AI Service persistiendo el estado en LangGraph.
 */
export async function sendChatMessage(message: string, threadId: string): Promise<ChatResult> {
  const token = getAccessToken()
  const res = await fetch(`${getApiBaseUrl()}/api/v1/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      message,
      threadId,
    }),
  })

  if (!res.ok) {
    let errorMsg = `Error al enviar mensaje (${res.status})`
    try {
      const data = (await res.json()) as Record<string, unknown>
      if (data && typeof data.error === 'string') errorMsg = data.error
    } catch {
      /* ignore */
    }
    throw new Error(errorMsg)
  }

  return (await res.json()) as ChatResult
}

export interface LabExamUploadResult {
  batchId: string
  summary: string
  measurementCount: number
  detectedMetrics: string[]
  storageKey?: string | null
}

/**
 * Sube un archivo de examen de laboratorio (imagen o PDF) al backend .NET
 * (POST /api/v1/lab-exams). El backend valida, comprime, almacena en S3,
 * extrae métricas mediante el AI Service y persiste en clinical_measurements.
 */
export async function uploadLabExam(file: File, threadId?: string): Promise<LabExamUploadResult> {
  const token = getAccessToken()
  const formData = new FormData()
  formData.append('file', file)
  if (threadId) {
    formData.append('threadId', threadId)
  }

  const res = await fetch(`${getApiBaseUrl()}/api/v1/lab-exams`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  })

  if (!res.ok) {
    let errorMsg = `Error al procesar el examen (${res.status})`
    try {
      const data = (await res.json()) as Record<string, unknown>
      if (data) {
        if (typeof data.error === 'string') {
          errorMsg = data.error
        } else if (typeof data.error === 'object' && data.error !== null) {
          const errObj = data.error as Record<string, unknown>
          if (typeof errObj.message === 'string') {
            errorMsg = errObj.message
          }
        } else if (typeof data.message === 'string') {
          errorMsg = data.message
        }
      }
    } catch {
      /* ignore */
    }

    if (!errorMsg || errorMsg.startsWith('Error al procesar')) {
      if (res.status === 422) {
        errorMsg = 'El archivo no pudo ser procesado o excede el límite permitido.'
      } else if (res.status === 502) {
        errorMsg = 'El servicio de IA no pudo procesar el examen de laboratorio.'
      } else if (res.status === 500) {
        errorMsg = 'No fue posible procesar la solicitud.'
      }
    }

    throw new Error(errorMsg)
  }

  return (await res.json()) as LabExamUploadResult
}