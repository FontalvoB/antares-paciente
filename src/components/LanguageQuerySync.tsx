import { useLayoutEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useI18n } from '../i18n/I18nContext'

/** Renueva la presentación sin desmontar formularios, reproductores ni mutaciones activas. */
export function LanguageQuerySync() {
  const { lang } = useI18n()
  const client = useQueryClient()
  const previous = useRef(lang)
  const refresh = useRef(0)
  useLayoutEffect(() => {
    if (previous.current === lang) return
    previous.current = lang
    client.removeQueries({ type: 'inactive' })
    const generation = ++refresh.current
    // Conserva el último dato confirmado: vaciarlo desmontaría las lecciones activas.
    // Cancelar primero impide que una respuesta ES tardía sustituya la nueva lectura EN.
    void client.cancelQueries({ type: 'active' }, { revert: true, silent: true }).then(() => {
      if (generation === refresh.current)
        return client.invalidateQueries({ type: 'active', refetchType: 'active' }, { cancelRefetch: true })
    }).catch(() => {})
  }, [client, lang])
  return null
}
