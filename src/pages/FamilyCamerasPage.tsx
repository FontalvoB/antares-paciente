import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { IonAlert, IonBadge, IonButton, IonIcon, IonInput, IonSkeletonText, IonToggle } from "@ionic/react";
import { arrowBack, copyOutline, eyeOutline, lockClosedOutline, peopleOutline, refreshOutline, shieldCheckmarkOutline, trashOutline, videocamOutline } from "ionicons/icons";
import { Screen, Scroll } from "../components/Screen";
import { FamilyCameraPreview } from "../components/family-cameras/FamilyCameraPreview";
import { useApp } from "../context/AppContext";
import { useI18n } from "../i18n/I18nContext";
import { apiFetch } from "../utils/apiClient";
import { getAccessToken } from "../utils/authApi";
import { sessionUserId } from "../utils/sessionIdentity";
import {
  familyCameraPath,
  getFamilyCameras,
  type FamilyCameraInvitation,
  type OwnFamilyCamera,
} from "../services/family-cameras/family-camera-service";
import "../theme/family-cameras.css";

type Sharing = { leader?: boolean; administrators?: boolean };

function OwnCameraCard({
  camera, hasLeader, disabled, onShare, onRemove, onPreview, preview,
}: {
  camera: OwnFamilyCamera;
  hasLeader: boolean;
  disabled: boolean;
  onShare: (sharing: Sharing) => Promise<boolean>;
  onRemove: () => void;
  onPreview: () => void;
  preview: boolean;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<Sharing>({});
  const [saved, setSaved] = useState(false);
  const leader = hasLeader && (draft.leader ?? camera.sharedWithLeader);
  const administrators = draft.administrators ?? camera.sharedWithAdministrators;
  const leaderChanged = leader !== camera.sharedWithLeader;
  const administratorsChanged = administrators !== camera.sharedWithAdministrators;
  const changes = {
    leader: leaderChanged ? leader : undefined,
    administrators: administratorsChanged ? administrators : undefined,
  };
  return (
    <article className="family-camera-card" aria-label={camera.name}>
      <div className="family-camera-card-heading">
        <div className="family-camera-icon"><IonIcon icon={videocamOutline} aria-hidden="true" /></div>
        <div>
          <h3>{camera.name}</h3>
          <p>{camera.sharedWithLeader || camera.sharedWithAdministrators ? t("Acceso compartido") : t("Privada")}</p>
        </div>
        {camera.provider === "demo" && <IonBadge className="family-camera-badge">{t("Simulación")}</IonBadge>}
      </div>
      <div className="family-camera-sharing">
        <IonToggle justify="space-between" checked={leader} disabled={disabled || !hasLeader} onIonChange={({ detail }) => {
          setDraft((value) => ({ ...value, leader: detail.checked }));
          setSaved(false);
        }}>{t("Compartir con el líder")}</IonToggle>
        <IonToggle justify="space-between" checked={administrators} disabled={disabled} onIonChange={({ detail }) => {
          setDraft((value) => ({ ...value, administrators: detail.checked }));
          setSaved(false);
        }}>{t("Compartir con administradores")}</IonToggle>
      </div>
      <div className="family-camera-actions">
        <IonButton disabled={disabled || !(leaderChanged || administratorsChanged)} onClick={() => void onShare(changes).then((success) => {
          if (success) {
            setDraft({});
            setSaved(true);
          }
        })}>{t("Guardar acceso")}</IonButton>
        <IonButton fill="outline" onClick={onPreview} aria-expanded={preview}>
          <IonIcon icon={eyeOutline} slot="start" aria-hidden="true" />
          {preview ? t("Cerrar cámara") : t("Ver cámara")}
        </IonButton>
        <IonButton fill="clear" color="danger" onClick={onRemove} aria-label={t("Quitar cámara")}>
          <IonIcon icon={trashOutline} slot="icon-only" aria-hidden="true" />
        </IonButton>
      </div>
      {saved && <p className="family-camera-saved" role="status">{t("Acceso actualizado")}</p>}
    </article>
  );
}

export function FamilyCamerasPage() {
  const { navigate, showToast } = useApp();
  const { lang, t } = useI18n();
  const locale = lang === "en" ? "en-US" : "es-CO";
  const accountId = sessionUserId(getAccessToken());
  const { data, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: ["family-cameras", accountId],
    queryFn: ({ signal }) => getFamilyCameras(accountId!, signal),
    enabled: accountId !== null,
    gcTime: 0,
    retry: false,
  });
  const [teamName, setTeamName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [cameraName, setCameraName] = useState("");
  const [invite, setInvite] = useState<FamilyCameraInvitation>();
  const [previewId, setPreviewId] = useState<string>();
  const [confirm, setConfirm] = useState<{ type: "leave" } | { type: "remove"; cameraId: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function act(action: () => Promise<unknown>, fallback: string, refresh = true) {
    setBusy(true);
    setError("");
    try {
      await action();
      if (refresh) await refetch();
      return true;
    } catch {
      setError(fallback);
      return false;
    } finally {
      setBusy(false);
    }
  }

  function send<T>(suffix: string, method: string, body?: unknown) {
    return apiFetch<T>(familyCameraPath + suffix, { method, body, expectedUserId: accountId, cache: "no-store" });
  }

  const team = data?.team;
  const ownCameras = data?.ownCameras ?? [];
  const sharedCameras = data?.sharedCameras ?? [];
  const preview = [...ownCameras, ...sharedCameras].find((camera) => camera.id === previewId);
  const selectPreview = (id: string) => setPreviewId((current) => current === id ? undefined : id);

  async function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await act(async () => {
      await send("/team/join", "POST", { code: joinCode.trim() });
      setJoinCode("");
    }, t("No pudimos unirte. Revisa que el código sea válido y siga vigente."));
  }

  return (
    <Screen className="family-camera-screen">
      <Scroll className="family-camera-scroll">
        <div className="family-camera-layout">
          <header className="family-camera-hero">
            <IonButton className="family-camera-back" fill="clear" onClick={() => navigate("prof")}>
              <IonIcon icon={arrowBack} slot="start" aria-hidden="true" />{t("Perfil")}
            </IonButton>
            <div className="family-camera-hero-copy">
              <div>
                <h1>{t("Cámaras familiares")}</h1>
                <p>{t("Configura tus cámaras y elige quién puede verlas.")}</p>
              </div>
              <span className="family-camera-hero-icon"><IonIcon icon={videocamOutline} aria-hidden="true" /></span>
            </div>
          </header>
          {(isPending && !!accountId) && <IonSkeletonText animated className="family-camera-skeleton" />}
          {(!accountId || isError) && (
            <section className="family-camera-panel" role="status">
              <h2>{t("No pudimos cargar las cámaras familiares.")}</h2>
              {!!accountId && <IonButton fill="outline" onClick={() => void refetch()}>{t("Reintentar")}</IonButton>}
            </section>
          )}
          {data && accountId && (
            <>
              {!!error && <p className="family-camera-error" role="alert">{error}</p>}
              <section className="family-camera-panel" aria-labelledby="family-team-heading">
                <div className="family-camera-section-title">
                  <div className="family-camera-icon"><IonIcon icon={peopleOutline} aria-hidden="true" /></div>
                  <div>
                    <h2 id="family-team-heading">{t("Equipo familiar")}</h2>
                    {team && <p>{team.name}</p>}
                  </div>
                  {team && <IonBadge className="family-camera-badge">{team.isLeader ? t("Líder") : t("Miembro")}</IonBadge>}
                </div>
                {team ? (
                  <>
                    <ul className="family-camera-members">
                      {team.members.map((member) => <li key={member.id}>
                        <span className="family-camera-initial">{member.name.trim().slice(0, 1).toLocaleUpperCase(locale)}</span>
                        <span>{member.name}</span>
                        {member.isLeader && <small>{t("Líder")}</small>}
                      </li>)}
                    </ul>
                    <div className="family-camera-actions family-camera-team-actions">
                      {team.isLeader && (
                        <IonButton fill="outline" disabled={busy} onClick={() => void act(async () => {
                          setInvite(await send<FamilyCameraInvitation>("/team/invitations", "POST"));
                        }, t("No pudimos generar la invitación."), false)}>{t("Generar código")}</IonButton>
                      )}
                      <IonButton fill="clear" disabled={busy} onClick={() => setConfirm({ type: "leave" })}>
                        {team.isLeader ? t("Cerrar equipo") : t("Salir del equipo")}
                      </IonButton>
                    </div>
                    {team.isLeader && invite && (
                      <div className="family-camera-invite">
                        <span>{t("Código de un solo uso")}</span>
                        <code data-testid="family-invitation-code">{invite.code}</code>
                        <small>{t("Vence {time}", { time: new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(new Date(invite.expiresAt)) })}</small>
                        <IonButton size="small" fill="clear" onClick={() => {
                          if (!navigator.clipboard) {
                            showToast(t("Selecciona el código para copiarlo."), "info");
                            return;
                          }
                          void navigator.clipboard.writeText(invite.code).then(
                            () => showToast(t("Código copiado"), "ok"),
                            () => showToast(t("Selecciona el código para copiarlo."), "info"),
                          );
                        }}>
                          <IonIcon icon={copyOutline} slot="start" aria-hidden="true" />{t("Copiar código")}
                        </IonButton>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="family-camera-forms">
                    <form onSubmit={(event) => {
                      event.preventDefault();
                      void act(async () => {
                        await send("/team", "POST", { name: teamName.trim() });
                        setTeamName("");
                      }, t("No pudimos crear el equipo."));
                    }}>
                      <IonInput label={t("Nombre del equipo")} labelPlacement="stacked" fill="outline" value={teamName} maxlength={80}
                        onIonInput={({ detail }) => setTeamName(detail.value ?? "")} />
                      <IonButton type="submit" disabled={busy || teamName.trim().length < 2}>{t("Crear equipo")}</IonButton>
                    </form>
                    <form onSubmit={(event) => { void join(event); }}>
                      <IonInput label={t("Código de invitación")} labelPlacement="stacked" fill="outline" value={joinCode} maxlength={16}
                        autocapitalize="characters" spellcheck={false} onIonInput={({ detail }) => setJoinCode(detail.value ?? "")} />
                      <IonButton type="submit" fill="outline" disabled={busy || !/^[0-9a-f]{16}$/i.test(joinCode.trim())}>{t("Unirme al equipo")}</IonButton>
                    </form>
                  </div>
                )}
              </section>
              {team?.isLeader && (
                <section className="family-camera-panel" aria-labelledby="family-shared-heading">
                  <div className="family-camera-section-title">
                    <div className="family-camera-icon family-camera-icon-sky"><IonIcon icon={eyeOutline} aria-hidden="true" /></div>
                    <h2 id="family-shared-heading">{t("Cámaras compartidas")}</h2>
                    <IonButton className="family-camera-refresh" fill="clear" disabled={isFetching}
                      aria-label={t("Actualizar cámaras")} onClick={() => void refetch()}>
                      <IonIcon icon={refreshOutline} slot="icon-only" aria-hidden="true" />
                    </IonButton>
                  </div>
                  {sharedCameras.length === 0 && <p className="family-camera-note">{t("Tu familia aún no ha compartido cámaras contigo.")}</p>}
                  {sharedCameras.map((camera) => (
                    <article key={camera.id} className="family-camera-card" aria-label={camera.name}>
                      <div className="family-camera-card-heading">
                        <div className="family-camera-icon"><IonIcon icon={videocamOutline} aria-hidden="true" /></div>
                        <div><h3>{camera.name}</h3><p>{camera.ownerName}</p></div>
                        {camera.provider === "demo" && <IonBadge className="family-camera-badge">{t("Simulación")}</IonBadge>}
                      </div>
                      <IonButton fill="outline" onClick={() => selectPreview(camera.id)} aria-expanded={previewId === camera.id}>
                        {previewId === camera.id ? t("Cerrar cámara") : t("Ver cámara")}
                      </IonButton>
                      {previewId === camera.id && <FamilyCameraPreview key={camera.id} cameraId={camera.id} accountId={accountId} />}
                    </article>
                  ))}
                </section>
              )}
              <section className="family-camera-panel" aria-labelledby="own-cameras-heading">
                <div className="family-camera-section-title">
                  <div className="family-camera-icon"><IonIcon icon={lockClosedOutline} aria-hidden="true" /></div>
                  <div><h2 id="own-cameras-heading">{t("Mis cámaras")}</h2>
                    <p>{t("Cada cámara empieza con acceso privado.")}</p>
                  </div>
                </div>
                {ownCameras.map((camera) => (
                  <div key={camera.id} className="family-camera-own">
                    <OwnCameraCard camera={camera} hasLeader={!!team && !team.isLeader} disabled={busy}
                      preview={previewId === camera.id} onPreview={() => selectPreview(camera.id)}
                      onRemove={() => setConfirm({ type: "remove", cameraId: camera.id })}
                      onShare={(sharing) => act(() => send(`/${camera.id}/sharing`, "PATCH", sharing), t("No pudimos guardar el acceso."))} />
                    {previewId === camera.id && <FamilyCameraPreview key={camera.id} cameraId={camera.id} accountId={accountId} />}
                  </div>
                ))}
                <form className="family-camera-add" onSubmit={(event) => {
                  event.preventDefault();
                  void act(async () => {
                    await send("/demo", "POST", { name: cameraName.trim() });
                    setCameraName("");
                  }, t("No pudimos añadir la cámara."));
                }}>
                  <IonInput label={t("Nombre de la cámara")} labelPlacement="stacked" fill="outline" value={cameraName} maxlength={80}
                    onIonInput={({ detail }) => setCameraName(detail.value ?? "")} />
                  <IonButton type="submit" disabled={busy || cameraName.trim().length < 2}>
                    <IonIcon icon={videocamOutline} slot="start" aria-hidden="true" />{t("Añadir cámara de prueba")}
                  </IonButton>
                </form>
                <p className="family-camera-note"><IonIcon icon={shieldCheckmarkOutline} aria-hidden="true" />
                  {t("La cámara de prueba usa una imagen simulada. La conexión física se habilitará tras validar el primer modelo.")}
                </p>
              </section>
              {previewId && !preview && <p className="family-camera-note" role="status">{t("El acceso a esta cámara ya no está disponible.")}</p>}
            </>
          )}
        </div>
        <IonAlert isOpen={!!confirm} onDidDismiss={() => setConfirm(undefined)}
          header={confirm?.type === "remove" ? t("Quitar cámara") : team?.isLeader ? t("Cerrar equipo") : t("Salir del equipo")}
          message={confirm?.type === "remove" ? t("Se retirará la cámara y se revocarán sus accesos.")
            : t("El acceso del líder a las cámaras compartidas de los miembros que salgan se revocará.")}
          buttons={[{ text: t("Cancelar"), role: "cancel" }, { text: t("Confirmar"), role: "destructive", handler: () => {
            if (!confirm) return;
            const path = confirm.type === "remove" ? `/${confirm.cameraId}` : "/team/membership";
            void act(async () => {
              await send(path, "DELETE");
              setPreviewId(undefined);
              setInvite(undefined);
            }, t("No pudimos completar esta acción."));
          } }]} />
      </Scroll>
    </Screen>
  );
}
