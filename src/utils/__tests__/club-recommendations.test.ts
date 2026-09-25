import { describe, expect, it } from "vitest";
import { recommendClubForCondition } from "../club-recommendations";
import type { Club } from "../../graphql/clubs";

function makeClub(overrides: Partial<Club> = {}): Club {
  return {
    id: "club-1",
    slug: "club-1",
    name: "Club general",
    description: "Comunidad general de salud",
    rules: [],
    objectives: [],
    category: "Salud",
    tags: ["salud"],
    coverUrl: null,
    logoUrl: null,
    visibility: "PUBLICO",
    maxMembers: null,
    status: "ACTIVO",
    memberCount: 10,
    myMembership: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

const nutritionClub = makeClub({
  id: "nut",
  name: "Club de Nutrición Saludable",
  category: "Nutrición",
  tags: ["nutricion", "recetas"],
});
const diabetesClub = makeClub({
  id: "dia",
  name: "Club Diabetes en control",
  category: "Diabetes",
  tags: ["diabetes", "glucosa"],
});
const sportClub = makeClub({
  id: "dep",
  name: "Muévete cada día",
  category: "Deporte",
  tags: ["ejercicio"],
});

describe("recommendClubForCondition", () => {
  it("Obesidad → club de Nutrición aunque no sea el primero", () => {
    const clubs = [sportClub, nutritionClub];
    expect(recommendClubForCondition(clubs, "Obesidad")?.id).toBe("nut");
  });

  it("Diabetes tipo 2 prefiere la categoría Diabetes sobre Nutrición", () => {
    const clubs = [nutritionClub, diabetesClub];
    expect(recommendClubForCondition(clubs, "Diabetes tipo 2")?.id).toBe("dia");
  });

  it("sin club de la categoría exacta cae a la siguiente preferida", () => {
    const clubs = [sportClub, nutritionClub];
    expect(recommendClubForCondition(clubs, "diabetes")?.id).toBe("nut");
  });

  it("insensible a mayúsculas y tildes (HIPERTENSIÓN → Salud)", () => {
    const clubs = [nutritionClub, makeClub({ id: "sal", category: "Salud" })];
    expect(recommendClubForCondition(clubs, "HIPERTENSIÓN")?.id).toBe("sal");
  });

  it("mención directa por tags cuando no hay regla (Yoga → club de yoga)", () => {
    const clubs = [
      nutritionClub,
      makeClub({ id: "yog", name: "Yoga suave", tags: ["yoga", "mente"] }),
    ];
    expect(recommendClubForCondition(clubs, "Yoga")?.id).toBe("yog");
  });

  it("sin coincidencia no recomienda (unión voluntaria, sin insignia)", () => {
    expect(
      recommendClubForCondition([nutritionClub], "Migraña crónica"),
    ).toBeNull();
  });

  it("condición vacía/nula o lista vacía → null", () => {
    expect(recommendClubForCondition([nutritionClub], null)).toBeNull();
    expect(recommendClubForCondition([nutritionClub], "   ")).toBeNull();
    expect(recommendClubForCondition([], "Obesidad")).toBeNull();
  });
});
