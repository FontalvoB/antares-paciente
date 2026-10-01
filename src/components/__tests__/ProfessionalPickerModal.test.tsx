/**
 * Tests de ProfessionalPickerModal: picker de profesional con búsqueda
 * server-side y badge de cupo (el select del wizard no escala a cientos de
 * profesionales). Se mockean Ionic (no monta overlays en happy-dom), el hook
 * i18n y los helpers de API; la lógica bajo prueba es la carga paginada, el
 * orden con cupo primero, el badge, la búsqueda con debounce y la selección.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";

const apiState = vi.hoisted(() => ({
  fetchProfessionalsCatalogPage: vi.fn(),
  fetchAvailableProfessionals: vi.fn(),
}));

vi.mock("../../utils/appointmentsApi", () => ({
  fetchProfessionalsCatalogPage: apiState.fetchProfessionalsCatalogPage,
  fetchAvailableProfessionals: apiState.fetchAvailableProfessionals,
}));

// `t` estable (en la app es useCallback): si cambia de identidad, los efectos
// con [t] en dependencias se re-ejecutan en bucle.
const i18nState = vi.hoisted(() => ({
  t: (key: string, params?: Record<string, string>) =>
    key.replace(/\{(\w+)\}/g, (_, name: string) => params?.[name] ?? name),
}));

vi.mock("../../i18n/I18nContext", () => ({
  useT: () => i18nState.t,
}));

vi.mock("@ionic/react", () => ({
  IonBadge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  IonButton: ({
    children,
    onClick,
    "aria-label": ariaLabel,
  }: {
    children?: ReactNode;
    onClick?: () => void;
    "aria-label"?: string;
  }) => (
    <button aria-label={ariaLabel} onClick={onClick}>
      {children}
    </button>
  ),
  IonButtons: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  IonContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  IonHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  IonIcon: () => <span />,
  IonInfiniteScroll: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  IonInfiniteScrollContent: () => <div />,
  IonItem: ({
    children,
    onClick,
  }: {
    children?: ReactNode;
    onClick?: () => void;
  }) => <div onClick={onClick}>{children}</div>,
  IonLabel: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  IonList: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  IonModal: ({
    children,
    isOpen,
  }: {
    children?: ReactNode;
    isOpen?: boolean;
  }) => (isOpen ? <div>{children}</div> : null),
  IonSearchbar: ({
    value,
    onIonInput,
    placeholder,
  }: {
    value?: string;
    onIonInput?: (e: { detail: { value: string } }) => void;
    placeholder?: string;
  }) => (
    <input
      aria-label={placeholder}
      value={value ?? ""}
      onChange={(e) => onIonInput?.({ detail: { value: e.target.value } })}
    />
  ),
  IonSpinner: () => <span role="status" />,
  IonTitle: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  IonToolbar: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

import { ProfessionalPickerModal } from "../ProfessionalPickerModal";
import type { ProfessionalCatalogItem } from "../../utils/appointmentsApi";

function pro(id: string, fullName: string): ProfessionalCatalogItem {
  return {
    id,
    employeeId: `e-${id}`,
    fullName,
    professionalTypeName: "Physician (MD/DO)",
    specialties: [],
    locations: [],
    clinicIds: [],
    status: "Active",
  };
}

const onSelect = vi.fn();
const onClose = vi.fn();

function renderModal(props: Partial<{ selectedId: string }> = {}) {
  return render(
    <ProfessionalPickerModal
      isOpen
      specialtyId="spec-1"
      organizationId="org-1"
      selectedId={props.selectedId ?? ""}
      onClose={onClose}
      onSelect={onSelect}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  apiState.fetchProfessionalsCatalogPage.mockResolvedValue({
    data: [pro("p2", "Zoe Última"), pro("p1", "Ana Primera")],
    total: 2,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  });
  apiState.fetchAvailableProfessionals.mockResolvedValue({
    specialtyId: "spec-1",
    from: "2026-10-01",
    to: "2026-10-14",
    timezoneOffset: "+00:00",
    professionals: [
      {
        professionalId: "p2",
        nextAvailableStart: "2026-10-02T09:00:00+00:00",
        availableDays: 3,
      },
    ],
  });
});

afterEach(cleanup);

describe("ProfessionalPickerModal", () => {
  it("carga el catálogo de la especialidad y pinta nombre, tipo y cupo", async () => {
    renderModal();

    expect(await screen.findByText("Ana Primera")).toBeTruthy();
    expect(screen.getByText("Zoe Última")).toBeTruthy();
    expect(screen.getAllByText("Physician (MD/DO)")).toHaveLength(2);
    // Solo Zoe tiene cupo en la respuesta mockeada.
    expect(screen.getAllByText("Con cupo")).toHaveLength(1);

    expect(apiState.fetchProfessionalsCatalogPage).toHaveBeenCalledWith(
      expect.objectContaining({
        specialtyId: "spec-1",
        status: "Active",
        page: 1,
        search: undefined,
      }),
    );
    expect(apiState.fetchAvailableProfessionals).toHaveBeenCalledWith(
      { specialtyId: "spec-1", organizationId: "org-1" },
      expect.objectContaining({ signal: expect.anything() }),
    );
  });

  it("ordena con cupo primero aunque el backend devuelva otro orden", async () => {
    renderModal();

    await screen.findByText("Ana Primera");
    const rows = screen.getAllByText(/Primera|Última/);
    expect(rows[0].textContent).toBe("Zoe Última");
  });

  it("busca contra el backend con debounce y envía el término", async () => {
    renderModal();
    await screen.findByText("Ana Primera");

    fireEvent.change(screen.getByLabelText("Buscar por nombre"), {
      target: { value: "zoe" },
    });

    await waitFor(() =>
      expect(apiState.fetchProfessionalsCatalogPage).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, search: "zoe" }),
      ),
    );
  });

  it("selecciona un profesional y avisa al wizard", async () => {
    renderModal({ selectedId: "p1" });
    await screen.findByText("Ana Primera");

    fireEvent.click(screen.getByText("Zoe Última"));

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "p2" }),
    );
  });

  it("muestra error recuperable si el catálogo falla", async () => {
    apiState.fetchProfessionalsCatalogPage.mockRejectedValueOnce(
      new Error("boom"),
    );
    renderModal();

    expect(
      await screen.findByText("No se pudieron cargar los profesionales"),
    ).toBeTruthy();
    expect(screen.getByText("Reintentar")).toBeTruthy();
  });
});
