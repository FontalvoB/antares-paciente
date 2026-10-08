/**
 * Tests de NotificationsModal (Fase 11, tarea 2.5).
 *
 * Se mockean el hook (misma ruta que importa el modal), la navegación y el
 * i18n: el modal solo agrupa "Hoy"/"Esta semana", pinta iconos temáticos y
 * hace deep-link clínico al tocar. Cobertura: agrupación temporal, punto de
 * no leída, mark-as-read + navegación por prefijo, "marcar todas" y estados
 * loading/error/empty. Los helpers puros se prueban sin DOM.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { useEffect, type ReactNode } from "react";

import type { InAppNotification } from "../../../services/notifications/types";

const hookState = vi.hoisted(() => ({
  notifications: [] as InAppNotification[],
  unreadCount: 0,
  isLoading: false,
  isError: false,
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  refresh: vi.fn(),
}));

const navigateMock = vi.fn();
const openTestsMock = vi.fn();

vi.mock("../../../hooks/useNotifications", () => ({
  useNotifications: () => hookState,
}));

vi.mock("../../../context/AppContext", () => ({
  useApp: () => ({ navigate: navigateMock, openTests: openTestsMock }),
}));

vi.mock("../../../i18n/I18nContext", () => ({
  useI18n: () => ({
    lang: "es",
    t: (key: string, params?: Record<string, string>) =>
      key.replace(/\{(\w+)\}/g, (_, name: string) => params?.[name] ?? name),
  }),
}));

// IonModal no monta su contenido en happy-dom (overlay nativo sin ion-app):
// se sustituye el shell Ionic por contenedores planos. La lógica bajo prueba
// (agrupación, deep-links, acciones) vive en el modal, no en Ionic.
vi.mock("@ionic/react", () => ({
  IonBadge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  IonButton: ({
    children,
    onClick,
  }: {
    children?: ReactNode;
    onClick?: () => void;
  }) => <button onClick={onClick}>{children}</button>,
  IonContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  IonIcon: () => <span />,
  IonModal: ({ children, isOpen, onWillPresent }: { children?: ReactNode; isOpen?: boolean; onWillPresent?: () => void }) => {
    useEffect(() => { if (isOpen) onWillPresent?.(); }, [isOpen, onWillPresent]);
    return <div>{children}</div>;
  },
  IonSkeletonText: () => <span />,
}));

import {
  NotificationsModal,
  resolveNotificationTarget,
  themeForNotification,
  formatNotificationTime,
} from "../NotificationsModal";

function notif(
  overrides: Partial<InAppNotification> & { id: string },
): InAppNotification {
  return {
    type: "appointment_reminder",
    title: "Título",
    message: "Mensaje",
    priority: "normal",
    channel: "inapp",
    sentAt: new Date().toISOString(),
    readAt: null,
    ...overrides,
  };
}

describe("resolveNotificationTarget — deep-links clínicos", () => {
  it("citas van a book, hidratación/nutrición a nut, chat a chat, comunidad/club a com", () => {
    expect(resolveNotificationTarget("appointment_reminder")).toBe("book");
    expect(resolveNotificationTarget("appointment_video_soon")).toBe("book");
    expect(resolveNotificationTarget("hydration_nudge")).toBe("nut");
    expect(resolveNotificationTarget("nutrition_plan")).toBe("nut");
    expect(resolveNotificationTarget("chat_followup")).toBe("chat");
    expect(resolveNotificationTarget("community_reply")).toBe("com");
    expect(resolveNotificationTarget("club_event")).toBe("com");
  });

  it("tipos desconocidos no navegan", () => {
    expect(resolveNotificationTarget("streak_milestone")).toBeNull();
    expect(resolveNotificationTarget("promo_xyz")).toBeNull();
  });
});

describe("themeForNotification — iconos temáticos", () => {
  it("asigna tono por familia del código", () => {
    expect(themeForNotification("appointment_reminder").tone).toBe("appt");
    expect(themeForNotification("appointment_video_soon").tone).toBe("appt");
    expect(themeForNotification("hydration_nudge").tone).toBe("hyd");
    expect(themeForNotification("nutrition_plan").tone).toBe("nut");
    expect(themeForNotification("streak_milestone").tone).toBe("streak");
    expect(themeForNotification("chat_followup").tone).toBe("chat");
    expect(themeForNotification("community_reply").tone).toBe("com");
    expect(themeForNotification("club_event").tone).toBe("com");
    expect(themeForNotification("alert_lab").tone).toBe("alert");
    expect(themeForNotification("unknown_xyz").tone).toBe("default");
  });
});

describe("formatNotificationTime — tiempos relativos", () => {
  const t = (key: string, params?: Record<string, string>) =>
    key.replace(/\{(\w+)\}/g, (_, name: string) => params?.[name] ?? name);
  const now = new Date("2026-09-24T12:00:00.000Z").getTime();

  it("minutos, horas, ayer y fecha larga", () => {
    expect(formatNotificationTime("2026-09-24T11:50:00.000Z", t, now)).toBe(
      "hace 10 min",
    );
    expect(formatNotificationTime("2026-09-24T09:00:00.000Z", t, now)).toBe(
      "hace 3 h",
    );
    expect(formatNotificationTime("2026-09-23T10:00:00.000Z", t, now)).toBe(
      "Ayer",
    );
    expect(formatNotificationTime("2026-09-10T10:00:00.000Z", t, now)).toBe(
      "10/09/2026",
    );
  });
});

describe("NotificationsModal — agrupación y acciones", () => {
  beforeEach(() => {
    hookState.notifications = [
      notif({
        id: "n-today",
        type: "appointment_reminder",
        title: "Cita hoy 3:00 PM",
        sentAt: new Date().toISOString(),
        readAt: null,
      }),
      notif({
        id: "n-week",
        type: "hydration_nudge",
        title: "Hidratación",
        sentAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        readAt: "2026-09-20T10:00:00.000Z",
      }),
    ];
    hookState.unreadCount = 1;
    hookState.isLoading = false;
    hookState.isError = false;
    hookState.markAsRead.mockResolvedValue(undefined);
    hookState.markAllAsRead.mockResolvedValue(undefined);
    hookState.markAsRead.mockClear();
    hookState.markAllAsRead.mockClear();
    hookState.refresh.mockClear();
    navigateMock.mockClear();
    openTestsMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("recarga los avisos al reabrir el centro sin reiniciar la app", () => {
    const view = render(<NotificationsModal isOpen={false} onClose={() => {}} />);
    expect(hookState.refresh).not.toHaveBeenCalled();
    view.rerender(<NotificationsModal isOpen onClose={() => {}} />);
    expect(hookState.refresh).toHaveBeenCalledOnce();
    view.rerender(<NotificationsModal isOpen={false} onClose={() => {}} />);
    view.rerender(<NotificationsModal isOpen onClose={() => {}} />);
    expect(hookState.refresh).toHaveBeenCalledTimes(2);
  });

  it("agrupa en Hoy (24 h) y Esta semana", () => {
    render(<NotificationsModal isOpen onClose={() => {}} />);
    expect(screen.getByText("Hoy")).toBeTruthy();
    expect(screen.getByText("Esta semana")).toBeTruthy();
    expect(screen.getByText("Cita hoy 3:00 PM")).toBeTruthy();
    expect(screen.getByText("Hidratación")).toBeTruthy();
  });

  it("coloca una notificación de septiembre en Anteriores en octubre", () => {
    hookState.notifications = [notif({ id: "old", sentAt: "2026-09-24T12:00:00Z", title: "Aviso antiguo" })];
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-08T12:00:00Z"));
    try {
      render(<NotificationsModal isOpen onClose={() => {}} />);
      expect(screen.getByText("Anteriores")).toBeTruthy();
      expect(screen.queryByText("Esta semana")).toBeNull();
    } finally { vi.useRealTimers(); }
  });

  it("el recordatorio de evaluación abre el flujo de tests", () => {
    hookState.notifications = [notif({ id: "test", type: "health_test_reminder", title: "Evaluación pendiente" })];
    render(<NotificationsModal isOpen onClose={() => {}} />);
    fireEvent.click(screen.getByText("Evaluación pendiente"));
    expect(openTestsMock).toHaveBeenCalledOnce();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("al tocar una cita la marca como leída y navega a book", () => {
    const onClose = vi.fn();
    render(<NotificationsModal isOpen onClose={onClose} />);
    fireEvent.click(screen.getByText("Cita hoy 3:00 PM"));
    expect(hookState.markAsRead).toHaveBeenCalledWith("n-today");
    expect(onClose).toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith("book");
  });

  it("al tocar hidratación navega a nut", () => {
    render(<NotificationsModal isOpen onClose={() => {}} />);
    fireEvent.click(screen.getByText("Hidratación"));
    expect(hookState.markAsRead).toHaveBeenCalledWith("n-week");
    expect(navigateMock).toHaveBeenCalledWith("nut");
  });

  it("botón superior marca todas como leídas", () => {
    render(<NotificationsModal isOpen onClose={() => {}} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Marcar todas como leídas" }),
    );
    expect(hookState.markAllAsRead).toHaveBeenCalled();
  });

  it("sin botón de marcar todo cuando no hay no leídas", () => {
    hookState.unreadCount = 0;
    hookState.notifications = hookState.notifications.map((n) => ({
      ...n,
      readAt: "2026-09-24T10:00:00.000Z",
    }));
    render(<NotificationsModal isOpen onClose={() => {}} />);
    expect(
      screen.queryByRole("button", { name: "Marcar todas como leídas" }),
    ).toBeNull();
  });

  it("loading muestra skeletons y error muestra reintento", () => {
    hookState.isLoading = true;
    hookState.notifications = [];
    const { unmount } = render(
      <NotificationsModal isOpen onClose={() => {}} />,
    );
    expect(document.querySelector(".nt-loading")).toBeTruthy();
    unmount();
    cleanup();

    hookState.isLoading = false;
    hookState.isError = true;
    render(<NotificationsModal isOpen onClose={() => {}} />);
    expect(
      screen.getByText("No pudimos cargar tus notificaciones"),
    ).toBeTruthy();
    fireEvent.click(screen.getByText("Reintentar"));
    expect(hookState.refresh).toHaveBeenCalled();
  });

  it("sin avisos muestra el estado vacío honesto", () => {
    hookState.notifications = [];
    hookState.unreadCount = 0;
    render(<NotificationsModal isOpen onClose={() => {}} />);
    expect(screen.getByText("No tienes notificaciones")).toBeTruthy();
  });
});
