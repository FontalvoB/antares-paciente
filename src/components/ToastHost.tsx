import { IonToast } from '@ionic/react'
import { useApp } from '../context/AppContext'

const EMOJI = { ok: '✓', warn: '🔔', err: '⚠️', info: 'ℹ️' } as const

export function ToastHost() {
  const { toast } = useApp()
  return (
    <IonToast
      className="app-toast"
      isOpen={!!toast}
      message={toast ? `${EMOJI[toast.kind]} ${toast.message}` : ''}
      duration={2600}
      position="bottom"
      onDidDismiss={() => {}}
    />
  )
}
