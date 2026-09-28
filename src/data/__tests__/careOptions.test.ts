import { describe, expect, it } from "vitest";
import {
  activeCareOptions,
  careVisualFor,
  dayHasSchedule,
  groupCareOptionsByCategory,
  isCatalogBookingDate,
  professionalsForSpecialty,
  splitSlotViews,
  toAvailableSlotViews,
  type CareOption,
} from "../careOptions";
import type {
  AvailabilitySlotDto,
  ProfessionalCatalogItem,
  SpecialtyDto,
} from "../../utils/appointmentsApi";

function specialty(
  overrides: Partial<SpecialtyDto> & { id: string },
): SpecialtyDto {
  return {
    code: `CODE_${overrides.id}`,
    name: `Especialidad ${overrides.id}`,
    category: "Medicina",
    description: null,
    isActive: true,
    ...overrides,
  };
}

function professional(
  overrides: Partial<ProfessionalCatalogItem> & { id: string },
): ProfessionalCatalogItem {
  return {
    employeeId: `emp-${overrides.id}`,
    fullName: `Profesional ${overrides.id}`,
    professionalTypeName: null,
    specialties: [],
    locations: [],
    clinicIds: [],
    status: "Active",
    ...overrides,
  };
}

describe("activeCareOptions — catálogo como fuente, sin hardcodear", () => {
  it("catálogo nulo → null (la UI no puede afirmar nada)", () => {
    expect(activeCareOptions(null)).toBeNull();
  });

  it("filtra inactivas y conserva el orden del backend", () => {
    const options = activeCareOptions([
      specialty({ id: "a", code: "FAMILY_MEDICINE", name: "Family Medicine" }),
      specialty({ id: "b", code: "LEGACY", isActive: false }),
      specialty({ id: "c", code: "URGENT_CARE", name: "Urgent Care" }),
    ]);
    expect(options?.map((o) => o.code)).toEqual([
      "FAMILY_MEDICINE",
      "URGENT_CARE",
    ]);
  });

  it("nuevos códigos del backend aparecen sin cambios de código", () => {
    const options = activeCareOptions([
      specialty({ id: "x", code: "FUTURE_SPECIALTY", name: "Futura" }),
    ]);
    expect(options).toHaveLength(1);
    expect(options?.[0]?.specialtyId).toBe("x");
  });
});

describe("groupCareOptionsByCategory — área = category", () => {
  it("agrupa por igualdad exacta y conserva orden de aparición", () => {
    const options: CareOption[] = [
      {
        specialtyId: "1",
        code: "A",
        name: "A",
        category: "Medicina",
        description: null,
      },
      {
        specialtyId: "2",
        code: "B",
        name: "B",
        category: "Nutrición",
        description: null,
      },
      {
        specialtyId: "3",
        code: "C",
        name: "C",
        category: "Medicina",
        description: null,
      },
    ];
    const groups = groupCareOptionsByCategory(options);
    expect(groups.map((g) => g.category)).toEqual(["Medicina", "Nutrición"]);
    expect(groups[0]?.options.map((o) => o.specialtyId)).toEqual(["1", "3"]);
  });

  it("lista vacía → sin grupos (vacío honesto)", () => {
    expect(groupCareOptionsByCategory([])).toEqual([]);
  });
});

describe("professionalsForSpecialty — igualdad exacta, sin regex", () => {
  const catalog = [
    professional({
      id: "p1",
      specialties: [{ id: "s1", name: "Family Medicine" }],
    }),
    professional({
      id: "p2",
      specialties: [{ id: "s2", name: "Clinical Nutrition" }],
      status: "Inactive",
    }),
    professional({
      id: "p3",
      specialties: [{ id: "s1", name: "Family Medicine" }],
    }),
  ];

  it("filtra por id exacto y solo activos", () => {
    expect(professionalsForSpecialty(catalog, "s1")?.map((p) => p.id)).toEqual([
      "p1",
      "p3",
    ]);
  });

  it("inactivo aunque coincida → excluido", () => {
    expect(professionalsForSpecialty(catalog, "s2")).toEqual([]);
  });

  it("catálogo nulo → null", () => {
    expect(professionalsForSpecialty(null, "s1")).toBeNull();
  });

  it("el nombre de la profesión no influye (sin inferencia por regex)", () => {
    const withNames = [
      professional({
        id: "p9",
        professionalTypeName: "Totalmente otro nombre",
        specialties: [{ id: "s1", name: "Family Medicine" }],
      }),
    ];
    expect(professionalsForSpecialty(withNames, "s1")).toHaveLength(1);
  });
});

describe("careVisualFor — estética por posición, no por nombre", () => {
  it("rota la paleta de forma determinista", () => {
    expect(careVisualFor(0)).toEqual(careVisualFor(4));
    expect(careVisualFor(1).tone).not.toBe(careVisualFor(0).tone);
  });
});

function slot(
  overrides: Partial<AvailabilitySlotDto> & { start: string },
): AvailabilitySlotDto {
  return {
    end: overrides.start,
    durationMinutes: 30,
    isAvailable: true,
    conflictReason: null,
    availableProfessionalCount: 1,
    ...overrides,
  };
}

describe("toAvailableSlotViews — B4: solo isAvailable en UI", () => {
  it("filtra ocupados/bloqueados y ordena por inicio", () => {
    // ISOs sin offset = hora local: determinista en cualquier TZ.
    const views = toAvailableSlotViews([
      slot({ start: "2026-10-05T10:00" }),
      slot({
        start: "2026-10-05T09:00",
        isAvailable: false,
        conflictReason: "Booked",
        availableProfessionalCount: 0,
      }),
      slot({
        start: "2026-10-05T09:30",
        isAvailable: false,
        conflictReason: "TooSoon",
        availableProfessionalCount: 0,
      }),
      slot({ start: "2026-10-05T14:00" }),
    ]);
    expect(views.map((v) => v.timeLabel)).toEqual(["10:00", "14:00"]);
    expect(views.map((v) => v.startIso)).toEqual([
      "2026-10-05T10:00",
      "2026-10-05T14:00",
    ]);
  });

  it("parte mañana/tarde por hora local", () => {
    const { morning, afternoon } = splitSlotViews(
      toAvailableSlotViews([
        slot({ start: "2026-10-05T11:30" }),
        slot({ start: "2026-10-05T12:00" }),
      ]),
    );
    expect(morning).toHaveLength(1);
    expect(afternoon).toHaveLength(1);
  });
});

describe("isCatalogBookingDate — ventana sin reglas por especialidad", () => {
  it("acepta hoy y el límite de 30 días, rechaza ayer y +31", async () => {
    const { toLocalISODate, addDaysToISO } = await import("../../utils/dates");
    const today = toLocalISODate();
    expect(isCatalogBookingDate(today)).toBe(true);
    expect(isCatalogBookingDate(addDaysToISO(today, 30))).toBe(true);
    expect(isCatalogBookingDate(addDaysToISO(today, 31))).toBe(false);
    expect(isCatalogBookingDate(addDaysToISO(today, -1))).toBe(false);
  });
});

describe("dayHasSchedule — jornada vs cupo", () => {
  it("distingue día con jornada llena de día sin jornada", () => {
    expect(
      dayHasSchedule([slot({ start: "2026-10-05T09:00", isAvailable: false })]),
    ).toBe(true);
    expect(dayHasSchedule([])).toBe(false);
  });
});
