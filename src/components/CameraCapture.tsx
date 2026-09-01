import { useEffect, useRef, useState } from 'react'
import { IonButton, IonIcon, IonSpinner } from '@ionic/react'
import { cameraOutline, imageOutline, closeOutline } from 'ionicons/icons'

/**
 * Captura de comida: cámara del dispositivo (getUserMedia) con fallback a
 * selección de archivo (demo en desktop). La cámara se detiene tras capturar
 * y al desmontar el componente.
 */
interface Props {
  onCapture: (blob: Blob, fileName: string) => void
  onCancel: () => void
}

type CamState = 'starting' | 'ready' | 'error' | 'capturing'

const MAX_WIDTH = 1280

export function CameraCapture({ onCapture, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [state, setState] = useState<CamState>('starting')
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Tu navegador no soporta cámara. Puedes seleccionar una imagen.')
        setState('error')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
        setState('ready')
      } catch (err) {
        if (cancelled) return
        if (err instanceof DOMException && err.name === 'NotAllowedError') {
          setError('Permiso de cámara denegado. Puedes seleccionar una imagen.')
        } else {
          setError('No se encontró una cámara disponible. Puedes seleccionar una imagen.')
        }
        setState('error')
      }
    }
    start()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  function capture() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    setState('capturing')
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, MAX_WIDTH / video.videoWidth)
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setState('error')
      setError('No se pudo capturar la imagen.')
      return
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    stopCamera()
    canvas.toBlob(
      (blob) => {
        if (blob) {
          onCapture(blob, `comida-${Date.now()}.jpg`)
        } else {
          setError('No se pudo capturar la imagen.')
          setState('error')
        }
      },
      'image/jpeg',
      0.9,
    )
  }

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    stopCamera()
    onCapture(file, file.name)
  }

  if (state === 'capturing') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 24 }}>
        <IonSpinner name="crescent" />
        <div style={{ fontSize: 13, color: 'var(--mu)' }}>Capturando…</div>
      </div>
    )
  }

  return (
    <div>
      {state === 'starting' && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
          <IonSpinner name="crescent" />
        </div>
      )}

      {(state === 'ready' || state === 'error') && (
        <>
          {state === 'ready' && (
            <video
              ref={videoRef}
              playsInline
              muted
              style={{ width: '100%', borderRadius: 14, aspectRatio: '4/3', objectFit: 'cover', background: '#000' }}
            />
          )}
          {state === 'error' && error && (
            <div className="card" style={{ margin: '0 0 10px', background: 'var(--org-l)', borderColor: '#F2C79B', fontSize: 13, color: 'var(--org)' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <IonButton
              style={{ flex: 1 }}
              onClick={capture}
              disabled={state !== 'ready'}
              aria-label="Tomar fotografía"
            >
              <IonIcon icon={cameraOutline} slot="start" />
              Tomar foto
            </IonButton>
            <IonButton style={{ flex: 1 }} fill="outline" onClick={() => fileInputRef.current?.click()}>
              <IonIcon icon={imageOutline} slot="start" />
              Seleccionar imagen
            </IonButton>
            <IonButton fill="clear" onClick={onCancel} aria-label="Cancelar cámara">
              <IonIcon icon={closeOutline} />
            </IonButton>
          </div>
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={onFileSelected}
      />
    </div>
  )
}