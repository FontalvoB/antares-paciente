import { describe, expect, it } from "vitest";
import * as ts from "typescript";
import en from "../en.json";
import es from "../es.json";
import { TESTS } from "../../data/tests";
import { PATIENT_TITLES, THEMES_BY_ID } from "../../components/tests/model";
import academySource from "../../pages/AcademyPage.tsx?raw";
import infinitoSource from "../../pages/InfinitoPage.tsx?raw";
import basePlist from "../../../ios/App/App/Info.plist?raw";
import englishPermissions from "../../../ios/App/App/en.lproj/InfoPlist.strings?raw";
import spanishPermissions from "../../../ios/App/App/es.lproj/InfoPlist.strings?raw";
import xcodeProject from "../../../ios/App/App.xcodeproj/project.pbxproj?raw";

const english: Record<string, string> = en;
const spanish: Record<string, string> = es;
const tokens = (text: string) =>
  [...text.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1]).sort();

function missingTranslations(sources: string[]) {
  return [...new Set(sources)].filter((source) => !english[source]);
}

/** Estas tarjetas usan tuplas anidadas y t(variable), fuera del escáner de literales. */
function inlineCatalogLabels(source: string) {
  const file = ts.createSourceFile("page.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const labels = new Set<string>();
  function visit(node: ts.Node) {
    if (ts.isStringLiteral(node) && ts.isArrayLiteralExpression(node.parent) && /[a-záéíóúñ]/i.test(node.text)) {
      labels.add(node.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return [...labels];
}

function permissionStrings(source: string) {
  return Object.fromEntries(
    [...source.matchAll(/"(NS\w+UsageDescription)"\s*=\s*"([^"\n]*)";/g)]
      .map((match) => [match[1], match[2]]),
  );
}

describe("Contrato de los catálogos i18n", () => {
  it("mantiene paridad de claves e identidad en español", () => {
    expect(Object.keys(english).sort()).toEqual(Object.keys(spanish).sort());
    expect(Object.entries(spanish).filter(([source, value]) => source !== value)).toEqual([]);
    expect(Object.entries(english).filter(([, value]) => !value.trim())).toEqual([]);
  });

  it("conserva todos los parámetros de interpolación, incluidos los repetidos", () => {
    const mismatches = Object.entries(english)
      .filter(([source, value]) => JSON.stringify(tokens(source)) !== JSON.stringify(tokens(value)))
      .map(([source]) => source);
    expect(mismatches).toEqual([]);
  });

  it("cubre títulos, secciones, preguntas, opciones, ayudas y unidades de las evaluaciones", () => {
    const labels = TESTS.flatMap((test) => [
      test.title, test.tag, test.sub,
      ...test.questions.flatMap((question) => [
        question.text, question.section, question.hint, question.unit,
        question.minLabel, question.maxLabel,
        ...(question.options ?? []).map((option) => option.text),
      ]),
    ]).filter((label): label is string => Boolean(label));
    labels.push(...Object.values(PATIENT_TITLES));
    labels.push(...Object.values(THEMES_BY_ID).flatMap((theme) => [theme.sub, theme.kicker]));
    expect(missingTranslations(labels)).toEqual([]);
    for (const title of Object.values(PATIENT_TITLES)) {
      expect(english[title], title).not.toBe(title);
    }
    expect(english.critico).toBe("critical");
  });

  it.each([
    ["Academia", academySource],
    ["INFINITO", infinitoSource],
  ])("traduce las tarjetas dinámicas de %s sin recurrir al español", (_name, source) => {
    const labels = inlineCatalogLabels(source);
    expect(labels.length).toBeGreaterThan(0);
    expect(missingTranslations(labels)).toEqual([]);
    const englishNames = new Set(["Community Global", "Leadership Coaches"]);
    expect(labels.filter((label) => english[label] === label && !englishNames.has(label))).toEqual([]);
  });

  it("cubre descripciones conocidas del catálogo clínico recibido del servidor", () => {
    const descriptions = [
      "Tratamiento integral de la obesidad (certificación ABOM).",
      "Cirugía bariátrica y metabólica.",
      "Nutrición clínica y dietoterapia.",
      "Psicología clínica.",
      "Enfermería médico-quirúrgica.",
      "Fisioterapia y rehabilitación funcional.",
      "Coordinación de cuidados y navegación del paciente.",
      "Atención prioritaria de urgencias no vitales.",
    ];
    expect(missingTranslations(descriptions)).toEqual([]);
    expect(descriptions.filter((source) => english[source] === source)).toEqual([]);
  });
});

describe("Permisos localizados de iOS", () => {
  it("localiza todos los propósitos de uso sin cambiar el texto español vigente", () => {
    const base = Object.fromEntries(
      [...basePlist.matchAll(/<key>(NS\w+UsageDescription)<\/key>\s*<string>([^<]*)<\/string>/g)]
        .map((match) => [match[1], match[2]]),
    );
    const english = permissionStrings(englishPermissions);
    const spanish = permissionStrings(spanishPermissions);
    expect(Object.keys(base).length).toBeGreaterThan(0);
    expect(spanish).toEqual(base);
    expect(Object.keys(english).sort()).toEqual(Object.keys(base).sort());
    expect(Object.entries(english).filter(([key, value]) => !value || value === spanish[key])).toEqual([]);
  });

  it("incluye ambas localizaciones en los recursos del target de Xcode", () => {
    expect(xcodeProject).toContain("en.lproj/InfoPlist.strings");
    expect(xcodeProject).toContain("es.lproj/InfoPlist.strings");
    expect(xcodeProject).toContain("InfoPlist.strings in Resources");
    expect(xcodeProject).toMatch(/knownRegions\s*=\s*\([^)]*\bes\b/s);
  });
});
