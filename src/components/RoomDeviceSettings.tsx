import { useEffect, useState } from "react";
import { IonButton, IonContent, IonIcon, IonModal, IonSelect, IonSelectOption, IonSpinner } from "@ionic/react";
import { closeOutline, headsetOutline, micOutline, videocamOutline } from "ionicons/icons";
import { useT } from "../i18n/I18nContext";

interface Props {
  isOpen: boolean;
  onClose(): void;
  canCamera: boolean;
  canMicrophone: boolean;
  busy: boolean;
  error: string;
  outputId: string;
  inputIds: { camera: string; microphone: string };
  onInput(kind: "camera" | "microphone", id: string): Promise<boolean>;
  onOutput(id: string): Promise<void>;
}

/** Muestra capacidades reales; iOS enruta la salida desde el sistema cuando setSinkId no existe. */
export function RoomDeviceSettings(props: Props) {
  const t = useT();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const canOutput = typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;
  useEffect(() => {
    if (!props.isOpen) return;
    let active = true;
    const refresh = async () => {
      try {
        const list = await navigator.mediaDevices?.enumerateDevices();
        if (!active) return;
        setDevices(list ?? []);
        setError(!list);
      } catch { if (active) setError(true); }
      finally { if (active) setLoading(false); }
    };
    setLoading(true);
    void refresh();
    navigator.mediaDevices?.addEventListener?.("devicechange", refresh);
    return () => { active = false; navigator.mediaDevices?.removeEventListener?.("devicechange", refresh); };
  }, [props.isOpen]);
  return <IonModal isOpen={props.isOpen} onDidDismiss={props.onClose} className="room-settings-modal">
    <IonContent>
      <div className="room-settings">
        <header><div><span className="room-eyebrow">{t("Tu consulta")}</span><h2>{t("Cámara y audio")}</h2></div>
          <IonButton fill="clear" aria-label={t("Cerrar")} onClick={props.onClose}><IonIcon slot="icon-only" icon={closeOutline} /></IonButton>
        </header>
        {loading ? <IonSpinner /> : <>
          {error && <p role="alert">{t("No se pudieron consultar los dispositivos.")}</p>}
          {([ ["videoinput", "camera", "Cámara", videocamOutline, props.canCamera],
              ["audioinput", "microphone", "Micrófono", micOutline, props.canMicrophone],
              ["audiooutput", "output", "Salida de audio", headsetOutline, canOutput] ] as const).map(([kind, key, label, icon, enabled]) => {
            const options = devices.filter(d => d.kind === kind && d.deviceId);
            return <section className="room-settings-field" key={kind}>
              <div><IonIcon icon={icon} /><strong>{t(label)}</strong></div>
              {key === "output" && !canOutput ? <p>{t("En este dispositivo, cambia el altavoz o los auriculares desde los controles de audio del sistema.")}</p> :
                <IonSelect aria-label={t(label)} placeholder={t("Dispositivo actual")} interface="action-sheet"
                  interfaceOptions={{ header: t(label) }} cancelText={t("Cancelar")}
                  value={key === "output" ? props.outputId : props.inputIds[key]}
                  disabled={!enabled || props.busy || options.length === 0}
                  onIonChange={event => {
                    const id = String(event.detail.value);
                    const select = event.target;
                    if (key === "output") void props.onOutput(id).catch(() => { select.value = props.outputId; });
                    else void props.onInput(key, id).then(changed => { if (!changed) select.value = props.inputIds[key]; });
                  }}>
                  {key === "output" && <IonSelectOption value="">{t("Predeterminada del sistema")}</IonSelectOption>}
                  {options.map((device, index) => <IonSelectOption key={device.deviceId} value={device.deviceId}>
                    {device.label || `${t(label)} ${index + 1}`}
                  </IonSelectOption>)}
                </IonSelect>}
              {!enabled && key !== "output" && <p>{t("Este dispositivo no está activo en la llamada.")}</p>}
              {enabled && options.length === 0 && !error && <p>{t("No hay otros dispositivos disponibles.")}</p>}
            </section>;
          })}
        </>}
        {props.error && <p className="room-device-error" role="alert">{props.error}</p>}
        {props.busy && <IonSpinner />}
        <IonButton expand="block" onClick={props.onClose}>{t("Listo")}</IonButton>
      </div>
    </IonContent>
  </IonModal>;
}
