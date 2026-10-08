import { useMemo } from "react";
import {
  IonBadge,
  IonButton,
  IonContent,
  IonIcon,
  IonModal,
  IonSkeletonText,
} from "@ionic/react";
import {
  calendarOutline,
  chatbubbleEllipsesOutline,
  checkmarkDoneOutline,
  close,
  flameOutline,
  notificationsOutline,
  peopleOutline,
  refreshOutline,
  restaurantOutline,
  shieldCheckmarkOutline,
  trophyOutline,
  videocamOutline,
  warningOutline,
  waterOutline,
} from "ionicons/icons";
import { useI18n } from "../../i18n/I18nContext";
import { useApp } from "../../context/AppContext";
import { useNotifications } from "../../hooks/useNotifications";
import { formatDateForDisplay } from "../../utils/dates";

import type { InAppNotification } from "../../services/notifications/types";
import type { Screen } from "../../types";

/**
 * Centro de avisos de salud in-app (Fase 11, tarea 2.3).
 *
 * Cumplimiento Ionic-first (skill `ionic-rules`): el overlay es `IonModal` con
 * `IonContent`, las acciones son `IonButton`, el conteo es `IonBadge` y la
 * carga usa `IonSkeletonText`. Las tarjetas son un componente de dominio
 * (excepción documentada como `PatientCard`/`MealCard`/`PostCard`): bento
 * blanco con borde sutil, punto de no leído e icono temático en pastel.
 *
 * Agrupación temporal: "Hoy" (últimas 24 h) y "Esta semana" (resto).
 * Al tocar un aviso se marca como leído y se navega a su destino clínico
 * (deep-link por prefijo de `type`); "Marcar todas como leídas" vacía el
 * conteo. Todo texto visible pasa por `t()` (skill `i18n-translations`).
 */


/** Destino clínico por prefijo del código de aviso. null = sin navegación. */
export function resolveNotificationTarget(type: string): Screen | null {
  if (type.startsWith("appointment_")) return "book";
  if (type.startsWith("hydration_") || type.startsWith("nutrition_"))
    return "nut";
  if (type.startsWith("chat_")) return "chat";
  if (type.startsWith("community_") || type.startsWith("club_")) return "com";
  return null;
}

interface IconTheme {
  icon: string;
  tone: string;
}

/** Icono temático + tono pastel según el código del aviso. */
export function themeForNotification(type: string): IconTheme {
  if (
    type.startsWith("appointment_video") ||
    type.startsWith("appointment_telemedicina")
  )
    return { icon: videocamOutline, tone: "appt" };
  if (type.startsWith("appointment_"))
    return { icon: calendarOutline, tone: "appt" };
  if (type.startsWith("hydration_")) return { icon: waterOutline, tone: "hyd" };
  if (type.startsWith("nutrition_"))
    return { icon: restaurantOutline, tone: "nut" };
  if (
    type.startsWith("streak_") ||
    type.startsWith("racha_") ||
    type.startsWith("achievement_")
  )
    return { icon: trophyOutline, tone: "streak" };
  if (type.startsWith("chat_"))
    return { icon: chatbubbleEllipsesOutline, tone: "chat" };
  if (type.startsWith("community_") || type.startsWith("club_"))
    return { icon: peopleOutline, tone: "com" };
  if (type.startsWith("alert_") || type.startsWith("alerta_"))
    return { icon: shieldCheckmarkOutline, tone: "alert" };
  if (type.startsWith("warning_") || type.startsWith("risk_"))
    return { icon: warningOutline, tone: "alert" };
  if (type.startsWith("fire_") || type.startsWith("flame_"))
    return { icon: flameOutline, tone: "streak" };
  return { icon: notificationsOutline, tone: "default" };
}

/** Marca temporal relativa ("hace {n} min", "Ayer", fecha dd/mm/aaaa). */
export function formatNotificationTime(
  sentAt: string,
  t: (source: string, params?: Record<string, string>) => string,
  now: number = Date.now(),
): string {
  const sent = new Date(sentAt).getTime();
  if (Number.isNaN(sent)) return formatDateForDisplay(sentAt.slice(0, 10));
  const diff = Math.max(0, now - sent);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return t("hace un momento");
  if (minutes < 60) return t("hace {n} min", { n: String(minutes) });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("hace {n} h", { n: String(hours) });
  const days = Math.floor(hours / 24);
  if (days < 2) return t("Ayer");
  if (days < 7) return t("hace {n} días", { n: String(days) });
  // formatDateForDisplay opera sobre YYYY-MM-DD (nunca el datetime wire).
  return formatDateForDisplay(sentAt.slice(0, 10));
}

export interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationsModal({
  isOpen,
  onClose,
}: NotificationsModalProps) {
  const { t } = useI18n();
  const { navigate, openTests } = useApp();
  const {
    notifications,
    unreadCount,
    isLoading,
    isError,
    markAsRead,
    markAllAsRead,
    refresh,
  } = useNotifications();

  const groups = useMemo(() => {
    if (!isOpen) return [];
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = new Date(dayStart);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const buckets: Record<string, InAppNotification[]> = { Hoy: [], "Esta semana": [], Anteriores: [] };
    for (const item of notifications) {
      const sent = new Date(item.sentAt).getTime();
      const key = sent >= dayStart ? "Hoy" : sent >= weekStart.getTime() ? "Esta semana" : "Anteriores";
      buckets[key].push(item);
    }
    return Object.entries(buckets).filter(([, items]) => items.length > 0);
  }, [notifications, isOpen]);

  // Con cache previa, un refetch fallido conserva la lista (patrón
  // useMetricsHistory): loading/error a pantalla completa solo sin datos.
  const showLoading = isLoading && notifications.length === 0;
  const showError = !showLoading && isError && notifications.length === 0;

  const handleSelect = (item: InAppNotification) => {
    // La lectura es best-effort: un fallo de red no bloquea la navegación.
    void markAsRead(item.id).catch(() => {});
    const target = resolveNotificationTarget(item.type);
    onClose();
    if (item.type === "health_test_reminder") openTests();
    else if (target) navigate(target);
  };

  const handleMarkAll = () => {
    void markAllAsRead().catch(() => {});
  };

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onClose}
      initialBreakpoint={1}
      breakpoints={[0, 1]}
      handle
      className="notifications-modal"
      aria-label={t("Notificaciones")}
    >
      <IonContent>
        <div className="nt-sheet">
          <div className="nt-head">
            <div className="nt-head-titles">
              <div className="nt-kicker">{t("Tus avisos de salud")}</div>
              <h2>
                {t("Notificaciones")}
                {unreadCount > 0 && (
                  <IonBadge className="nt-count" aria-hidden="true">
                    {unreadCount > 99 ? "99+" : String(unreadCount)}
                  </IonBadge>
                )}
              </h2>
            </div>
            <IonButton
              fill="clear"
              aria-label={t("Cerrar")}
              onClick={onClose}
              className="nt-close"
            >
              <IonIcon slot="icon-only" icon={close} />
            </IonButton>
          </div>

          {unreadCount > 0 && !showLoading && !showError && (
            <IonButton
              fill="clear"
              size="small"
              className="nt-mark-all"
              onClick={handleMarkAll}
            >
              <IonIcon slot="start" icon={checkmarkDoneOutline} />
              {t("Marcar todas como leídas")}
            </IonButton>
          )}

          {showLoading ? (
            <div className="nt-loading" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="nt-card nt-skeleton">
                  <IonSkeletonText
                    animated
                    style={{ width: 44, height: 44, borderRadius: 14 }}
                  />
                  <div className="nt-skeleton-body">
                    <IonSkeletonText
                      animated
                      style={{ width: "68%", height: 15 }}
                    />
                    <IonSkeletonText
                      animated
                      style={{ width: "92%", height: 11 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : showError ? (
            <div className="nt-empty">
              <IonIcon icon={notificationsOutline} aria-hidden="true" />
              <p>{t("No pudimos cargar tus notificaciones")}</p>
              <IonButton size="small" onClick={refresh}>
                <IonIcon slot="start" icon={refreshOutline} />
                {t("Reintentar")}
              </IonButton>
            </div>
          ) : notifications.length === 0 ? (
            <div className="nt-empty">
              <IonIcon icon={notificationsOutline} aria-hidden="true" />
              <p>{t("No tienes notificaciones")}</p>
            </div>
          ) : (
            <>
              {groups.map(([label, items]) => (
                <section key={label} aria-label={t(label)}>
                  <h3 className="nt-section">{t(label)}</h3>
                  <div className="nt-list">
                    {items.map((item) => <NotificationCard key={item.id} item={item} onSelect={handleSelect} />)}
                  </div>
                </section>
              ))}
            </>
          )}
        </div>
      </IonContent>
    </IonModal>
  );
}

function NotificationCard({
  item,
  onSelect,
}: {
  item: InAppNotification;
  onSelect: (item: InAppNotification) => void;
}) {
  const { t } = useI18n();
  const theme = themeForNotification(item.type);
  const unread = item.readAt === null;
  return (
    <button
      type="button"
      className={`nt-card${unread ? " unread" : ""}`}
      onClick={() => onSelect(item)}
      aria-label={`${item.title}. ${formatNotificationTime(item.sentAt, t)}${unread ? `. ${t("Sin leer")}` : ""}`}
    >
      <span className={`nt-ico nt-ico-${theme.tone}`} aria-hidden="true">
        <IonIcon icon={theme.icon} />
      </span>
      <span className="nt-body">
        <span className="nt-title-row">
          <strong>{item.title}</strong>
          {unread && <i className="nt-dot" aria-hidden="true" />}
        </span>
        <span className="nt-msg">{item.message}</span>
        <time className="nt-time" dateTime={item.sentAt}>
          {formatNotificationTime(item.sentAt, t)}
        </time>
      </span>
    </button>
  );
}
