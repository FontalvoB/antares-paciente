import { IonIcon } from '@ionic/react'
import { chatbubbleEllipses } from 'ionicons/icons'
import { useApp } from '../context/AppContext'

/**
 * Botón flotante de acceso rápido al chat (FAB).
 * Aparece en la esquina inferior derecha de las pantallas de la app
 * (no en login/onboarding/tests) y abre la vista de chat.
 */
export function ChatFab() {
  const { flow, screen, navigate } = useApp()

  // Solo en la app, cuando no estás ya en el chat y fuera de Comunidad
  // (la comunidad tiene su propio acceso al chat: sidebar y menú del FAB).
  if (flow !== 'app' || screen === 'chat' || screen === 'com') return null

  return (
    <button
      type="button"
      className="chat-fab"
      onClick={() => navigate('chat')}
      aria-label="Abrir chat"
    >
      <IonIcon icon={chatbubbleEllipses} style={{ fontSize: 26 }} />
    </button>
  )
}
