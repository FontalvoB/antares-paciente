import { describe, expect, it } from "vitest";
import { DAY_NAMES, EXERCISE_GUIDE, PHASES } from "../../features/wellness/exercise/exercise-catalog";
import en from "../en.json";
import es from "../es.json";

const spanish: Record<string, string> = es;
const english: Record<string, string> = en;

describe("catálogo dinámico de ejercicio", () => {
  it("incluye las claves de cada ejercicio, fase y tipo de sesión en ambos idiomas", () => {
    const keys = new Set([
      ...Object.values(EXERCISE_GUIDE).flatMap(({ es: guide }) => Object.values(guide).flat()),
      ...Object.values(DAY_NAMES).map(([key]) => key),
      ...PHASES.map(({ name: [key] }) => key),
    ]);
    const missing = [...keys].filter((key) => spanish[key] !== key || !english[key]?.trim());
    expect(missing).toEqual([]);
  });
});
