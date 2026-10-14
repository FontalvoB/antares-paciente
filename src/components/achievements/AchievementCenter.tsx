import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import {
  IonButton,
  IonContent,
  IonIcon,
  IonModal,
  IonToast,
} from "@ionic/react";
import {
  closeOutline,
  trophyOutline,
  shareSocialOutline,
} from "ionicons/icons";
import { useAchievements } from "../../hooks/useAchievements";
import { useT } from "../../i18n/I18nContext";
import { useApp } from "../../context/AppContext";
import { programKeys } from "../../hooks/queryKeys";
import type { ProgramSnapshotDto } from "../../services/program/types";
import {
  observeAchievements,
  getAchievements,
  markAchievementRead,
  type EarnedAchievement,
} from "../../services/achievements/achievement-store";
import { achievementCopy } from "../../services/achievements/achievement-copy";
import {
  enableAchievementNotifications,
  notifyAchievement,
} from "../../services/achievements/native-notifications";
import { AchievementShare } from "./AchievementShare";

/** Overlay único en Shell; escucha únicamente éxitos de red, nunca setQueryData optimista. */
export function AchievementCenter() {
  const { owner, items } = useAchievements();
  const t = useT();
  const { showToast } = useApp();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<EarnedAchievement | null>(null);
  const [notice, setNotice] = useState<EarnedAchievement | null>(null);
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  useEffect(() => {
    if (!owner) return;
    let active = true;
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (
        event.type !== "updated" ||
        event.action.type !== "success" ||
        event.action.manual ||
        event.query.queryHash !== JSON.stringify(programKeys.snapshot)
      )
        return;
      const data = event.query.state.data as ProgramSnapshotDto | undefined;
      if (!data || !active) return;
      const earned = observeAchievements(owner, data);
      const featured =
        earned.find((a) => a.kind === "streak") ??
        earned.find((a) => a.kind === "day") ??
        earned[0];
      if (featured) {
        setNotice(featured);
        const copy = achievementCopy(featured, t);
        void notifyAchievement(
          copy.title,
          copy.message,
          () => active && ownerRef.current === owner,
          featured.id,
        ).catch(() => {});
      }
    });
    // Garantiza una primera lectura real, incluso si otras pantallas tenían cache fresca.
    void queryClient
      .refetchQueries(
        { queryKey: programKeys.snapshot, type: "active" },
        { cancelRefetch: false },
      )
      .catch(() => {});
    return () => {
      active = false;
      unsubscribe();
    };
  }, [owner, queryClient, t]);
  useEffect(() => {
    const show = (event?: Event) => {
      const detail = (event as CustomEvent<{ id?: string; days?: number }> | undefined)?.detail;
      const achievement = getAchievements(owner).find(a => detail?.id ? a.id === detail.id : detail?.days ? a.kind === "streak" && a.value === detail.days : false);
      if (achievement) markAchievementRead(owner, achievement.id);
      setSelected(achievement ?? null);
      setOpen(true);
    };
    window.addEventListener("achievements:open", show);
    let active = true;
    const listener = Capacitor.isNativePlatform()
      ? LocalNotifications.addListener(
          "localNotificationActionPerformed",
          (action) => {
            if (
              active &&
              action.notification.extra?.destination === "achievements"
            )
              show(new CustomEvent("achievements:open", { detail: { id: action.notification.extra?.achievementId } }));
          },
        )
      : null;
    return () => {
      active = false;
      window.removeEventListener("achievements:open", show);
      void listener?.then((l) => l.remove()).catch(() => {});
    };
  }, [owner]);
  return (
    <>
      <IonToast
        isOpen={!!notice}
        message={notice ? achievementCopy(notice, t).title : ""}
        duration={6000}
        position="top"
        onDidDismiss={() => setNotice(null)}
        buttons={[
          {
            text: t("Compartir logro"),
            handler: () => {
              if (notice) {
                markAchievementRead(owner, notice.id);
                setSelected(notice);
                setOpen(true);
              }
            },
          },
        ]}
      />
      <IonModal
        isOpen={open}
        onDidDismiss={() => {
          setOpen(false);
          setSelected(null);
        }}
        className="achievement-modal"
      >
        <IonContent>
          <div className="achievement-sheet">
            <header className="achievement-sheet-head">
              <div>
                {!selected && <small>{t("CADA PASO CUENTA")}</small>}
                <h2>{selected ? t("Comparte tu logro") : t("Mis logros")}</h2>
              </div>
              <IonButton
                fill="clear"
                aria-label={t("Cerrar")}
                onClick={() => setOpen(false)}
              >
                <IonIcon icon={closeOutline} />
              </IonButton>
            </header>
            {selected ? (
              <AchievementShare
                key={selected.id}
                achievement={selected}
                onBack={() => setOpen(false)}
              />
            ) : (
              <>
                <div className="achievement-intro">
                  <IonIcon icon={trophyOutline} />
                  <h3>{t("Tu progreso, tu historia")}</h3>
                  <p>
                    {t(
                      "Logros confirmados de tu programa. Elige uno para crear una tarjeta y compartirlo.",
                    )}
                  </p>
                </div>
                {items.length === 0 && (
                  <p>
                    {t(
                      "Tus próximos logros aparecerán aquí cuando se confirme tu progreso.",
                    )}
                  </p>
                )}
                {items.map((item) => (
                  <div className="achievement-earned" key={item.id}>
                    <IonIcon icon={trophyOutline} />
                    <div>
                      <strong>{achievementCopy(item, t).title}</strong>
                      <small>{achievementCopy(item, t).message}</small>
                    </div>
                    <IonButton
                      fill="clear"
                      aria-label={t("Compartir logro")}
                      onClick={() => {
                        markAchievementRead(owner, item.id);
                        setSelected(item);
                      }}
                    >
                      <IonIcon slot="icon-only" icon={shareSocialOutline} />
                    </IonButton>
                  </div>
                ))}
                <p className="achievement-social-hint">
                  {t(
                    "Los logros se actualizan al sincronizar tu programa. Los avisos se guardan en este dispositivo.",
                  )}
                </p>
              </>
            )}
                {!selected && Capacitor.isNativePlatform() && (
                  <IonButton
                    className="achievement-notification-action"
                    fill="clear"
                    onClick={() =>
                      void enableAchievementNotifications()
                        .then((enabled) =>
                          showToast(
                            enabled
                              ? t("Avisos de logros activados")
                              : t(
                                  "Activa las notificaciones en los ajustes del teléfono para recibir avisos.",
                                ),
                          ),
                        )
                        .catch(() =>
                          showToast(
                            t("No se pudo activar el aviso. Intenta de nuevo."),
                            "err",
                          ),
                        )
                    }
                  >
                    {t("Activar avisos de logros")}
                  </IonButton>
                )}
          </div>
        </IonContent>
      </IonModal>
    </>
  );
}
