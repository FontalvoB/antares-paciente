/**
 * Cliente del endpoint de chat (backend .NET → AI Service).
 * En desarrollo se consume a través del proxy de Vite (mismo origen →
 * funciona sin CORS). El contrato público del API .NET es camelCase:
 * enviamos { message, threadId } y recibimos { reply, threadId, agent }.
 */
export interface ChatResult {
  reply: string
  threadId: string
  /** Perfil de agente que respondió (base | nutrition | medical | psychology). */
  agent?: string
}

export async function sendChatMessage(message: string, threadId?: string): Promise<ChatResult> {
  const res = await fetch('/api/v1/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, threadId }),
  })

  if (!res.ok) {
    let detail = 'Error al conectarse con el servidor'
    try {
      const data = await res.json()
      if (data && typeof data.message === 'string') detail = data.message
      else if (data && typeof data.error === 'string') detail = data.error
    } catch {
      /* el cuerpo no es JSON */
    }
    throw new Error(detail)
  }

  return res.json() as Promise<ChatResult>
}
