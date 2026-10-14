import { useState } from 'react'
import { IonAlert, IonButton, IonIcon, IonActionSheet } from '@ionic/react'
import { ellipsisHorizontal, trashOutline, flagOutline } from 'ionicons/icons'
import { useI18n } from '../../i18n/I18nContext'

export function OwnPostDeleteButton({ postId, authorId, myId, onDelete, onDeleted, onToast, onReport }: {
  onReport?: () => void;
  postId: string; authorId: string; myId?: string | null;
  onDelete?: (id: string) => Promise<void>; onDeleted?: () => void;
  onToast: (message: string, kind?: 'ok' | 'err' | 'info' | 'warn') => void;
}) {
  const { t } = useI18n()
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [menu, setMenu] = useState(false)
  const canDelete = !!myId && myId === authorId && !!onDelete
  if (!canDelete && !onReport) return null
  const remove = async () => {
    if (busy) return
    setBusy(true)
    try { await onDelete?.(postId); onToast(t('Publicación eliminada'), 'ok'); onDeleted?.() }
    catch { onToast(t('No se pudo eliminar la publicación. Inténtalo de nuevo.'), 'err') }
    finally { setBusy(false) }
  }
  return <>
    <IonButton fill="clear" className="com-delete-post" disabled={busy} aria-label={t('Opciones de publicación')} onClick={() => setMenu(true)}>
      <IonIcon slot="icon-only" icon={ellipsisHorizontal} />
    </IonButton>
    <IonActionSheet isOpen={menu} onDidDismiss={() => setMenu(false)} buttons={[
      ...(canDelete ? [{ text: t('Eliminar mi publicación'), icon: trashOutline, role: 'destructive', handler: () => { setMenu(false); setConfirm(true) } }] : []),
      ...(onReport ? [{ text: t('Reportar publicación'), icon: flagOutline, handler: () => { setMenu(false); onReport() } }] : []),
      { text: t('Cancelar'), role: 'cancel' },
    ]} />
    <IonAlert isOpen={confirm} onDidDismiss={() => setConfirm(false)} header={t('Eliminar publicación')}
      message={t('Tu publicación dejará de aparecer en la comunidad. ¿Quieres eliminarla?')}
      buttons={[{text:t('Cancelar'),role:'cancel'},{text:t('Eliminar'),role:'destructive',handler:()=>{setConfirm(false);void remove()}}]} />
  </>
}
