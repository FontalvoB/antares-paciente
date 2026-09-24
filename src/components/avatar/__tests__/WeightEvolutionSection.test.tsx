import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WeightEvolutionSection } from "../WeightEvolutionSection";
import type { WeightRecord } from "../avatar-body-state";

vi.mock("../../../i18n/I18nContext", () => ({
  useT: () => (key: string, params?: Record<string, string>) => {
    let out = key;
    if (params) {
      for (const [k, v] of Object.entries(params))
        out = out.split(`{${k}}`).join(v);
    }
    return out;
  },
}));

vi.mock("../../../context/AppContext", () => ({
  useApp: () => ({ navigate: vi.fn(), showToast: vi.fn() }),
}));

vi.mock("../../../utils/dates", () => ({
  formatDateForDisplay: (iso: string) => iso,
}));

const records: WeightRecord[] = [
  { date: "2026-01-01", value: 80 },
  { date: "2026-02-01", value: 78 },
];

function renderSection(canRecordWeight: boolean) {
  return render(
    <WeightEvolutionSection
      records={records}
      status="ready"
      canRecordWeight={canRecordWeight}
      selectedDate={null}
      onSelectDate={() => {}}
      onRefresh={() => {}}
      onSaved={() => {}}
      showEvolution
    />,
  );
}

describe("WeightEvolutionSection — registro Admin-only", () => {
  it("con rol paciente no muestra el botón de registrar peso (solo lectura)", () => {
    renderSection(false);
    expect(screen.queryByText("Registrar peso")).toBeNull();
    expect(screen.getByText("Actualizar historial")).toBeTruthy();
    expect(screen.getByText("Evolución del peso registrado")).toBeTruthy();
  });

  it("con rol Admin sí muestra el botón de registrar peso", () => {
    renderSection(true);
    expect(screen.getByText("Registrar peso")).toBeTruthy();
  });
});
