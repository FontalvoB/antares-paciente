import { IonButton, IonIcon, IonModal } from '@ionic/react'
import { close, expand } from 'ionicons/icons'

/** Visionado a pantalla completa de una imagen/video de publicación.
 *  Fondo oscuro, contenido centrado, cerrar con ✕ o tap fuera. */
export function MediaLightbox({
  url,
  mediaType,
  onClose,
}: {
  url: string | null
  mediaType?: 'IMAGE' | 'VIDEO' | null
  onClose: () => void
}) {
  const isVideo = mediaType === 'VIDEO'
  return (
    <IonModal isOpen={!!url} onDidDismiss={onClose}>
      <div className="mbl" onClick={onClose} role="dialog" aria-modal="true" aria-label="Imagen de la publicación">
        <div className="mbl-topbar" onClick={(e) => e.stopPropagation()}>
          <IonButton className="mbl-close" onClick={onClose} aria-label="Cerrar">
            <IonIcon icon={close} />
          </IonButton>
        </div>
        {url && (
          <div className="mbl-body" onClick={(e) => e.stopPropagation()}>
            {isVideo ? (
              <video className="mbl-media" src={url} controls autoPlay playsInline />
            ) : (
              <img className="mbl-media" src={url} alt="Imagen ampliada" />
            )}
            <div className="mbl-hint">
              <IonIcon icon={expand} style={{ fontSize: 13 }} /> Toca fuera para cerrar
            </div>
          </div>
        )}
      </div>
    </IonModal>
  )
}
