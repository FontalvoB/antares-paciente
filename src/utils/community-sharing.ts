import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'

/** Comparte contenido real; no inventa enlaces a un sitio sin rutas públicas. */
export async function shareCommunityContent(title: string, text: string): Promise<'shared' | 'copied' | 'cancelled'> {
  try {
    if (Capacitor.isNativePlatform()) {
      await Share.share({ title, text, dialogTitle: title })
      return 'shared'
    }
    if (navigator.share) {
      await navigator.share({ title, text })
      return 'shared'
    }
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return 'cancelled'
    throw error
  }
}
