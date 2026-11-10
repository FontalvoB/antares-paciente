import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AssessmentResults } from "../AssessmentResults";
import { I18nProvider } from "../../../i18n/I18nContext";
import type { MeResult } from "../../../utils/healthTestsApi";

vi.mock("../AssessmentProfileAnalysis", () => ({ AssessmentProfileAnalysis: () => null }));
const result: MeResult = { id: "result", evaluationId: "evaluation", resultType: "score", code: "orp", label: "Cuestionario ORP", value: 21, qualifier: "Alto", severity: "high" };

describe("procedencia de las clasificaciones registradas", () => {
  beforeEach(() => localStorage.clear());
  it.each(["es", "en"])("atribuye la etiqueta al cuestionario y conserva el valor (%s)", language => {
    localStorage.setItem("antares_lang", language);
    render(<I18nProvider><AssessmentResults results={[result]} error={false} onEnter={() => {}} onCommunity={() => {}} /></I18nProvider>);
    expect(screen.getByText(language === "en" ? "Your cardiovascular questionnaire" : "Tu cuestionario cardiovascular")).toBeTruthy();
    expect(screen.getByText(language === "en" ? "According to the questionnaire: High" : "Según el cuestionario: Alto")).toBeTruthy();
    expect(screen.getByText("21")).toBeTruthy();
    expect(result.qualifier).toBe("Alto");
    expect(result.severity).toBe("high");
  });
});
