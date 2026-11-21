import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HTMLAttributes } from "react";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { MedicalSourcesPage } from "../MedicalSourcesPage";
import { medicalSources } from "../../data/medicalSources";
import { I18nProvider } from "../../i18n/I18nContext";
import es from "../../i18n/es.json";
import en from "../../i18n/en.json";

const app = vi.hoisted(() => ({
  navigate: vi.fn(),
  showToast: vi.fn(),
  medicalSourcesEntry: null as { section: string; returnTo: string } | null,
}));

vi.mock("../../context/AppContext", () => ({ useApp: () => app }));
vi.mock("framer-motion", async () => {
  const { createElement } = await import("react");
  return {
    motion: {
      div: ({ className, children }: HTMLAttributes<HTMLDivElement>) =>
        createElement("div", { className }, children),
    },
    useReducedMotion: () => true,
  };
});
vi.mock("@capacitor/browser", () => ({ Browser: { open: vi.fn() } }));

function renderPage() {
  return render(
    <I18nProvider>
      <MedicalSourcesPage />
    </I18nProvider>,
  );
}

describe("MedicalSourcesPage", () => {
  beforeEach(() => {
    app.medicalSourcesEntry = null;
    localStorage.clear();
  });

  it("muestra las secciones, sus citas y la información educativa", () => {
    renderPage();

    const title = screen.getByRole("heading", {
      level: 1,
      name: "Fuentes y referencias médicas",
    });
    expect(document.activeElement).toBe(title);
    expect(screen.getByText("Última revisión: noviembre de 2026")).toBeTruthy();
    expect(
      screen.getByText(
        "Esta información es educativa y no sustituye el consejo de un profesional de la salud.",
      ),
    ).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(
      medicalSources.length,
    );

    for (const { title, summary, sources } of medicalSources) {
      const section = within(screen.getByRole("region", { name: title }));
      expect(section.getByText(summary)).toBeTruthy();
      expect(section.getAllByRole("link")).toHaveLength(sources.length);
      expect(es[title]).toBe(title);
      expect(en[title]).toBeTruthy();
      expect(es[summary]).toBe(summary);
      expect(en[summary]).toBeTruthy();
      for (const source of sources) {
        expect(section.getByText(source.title)).toBeTruthy();
        expect(es[source.title]).toBe(source.title);
        expect(en[source.title]).toBeTruthy();
        expect(es[source.organization]).toBe(source.organization);
        expect(en[source.organization]).toBeTruthy();
      }
    }
  });

  it("enfoca la sección solicitada y vuelve a la pantalla de origen", async () => {
    app.medicalSourcesEntry = { section: "imc", returnTo: "home" };
    renderPage();

    const section = screen.getByRole("heading", {
      level: 2,
      name: "IMC y clasificación de peso",
    });
    await waitFor(() => expect(document.activeElement).toBe(section));
    fireEvent.click(screen.getByLabelText("Volver"));

    expect(app.navigate).toHaveBeenCalledWith("home");
  });

  it("publica enlaces HTTPS con etiquetas accesibles y aislamiento de pestaña", () => {
    renderPage();

    for (const link of screen.getAllByRole<HTMLAnchorElement>("link")) {
      expect(new URL(link.href).protocol).toBe("https:");
      expect(link.target).toBe("_blank");
      expect(link.rel.split(/\s+/)).toEqual(
        expect.arrayContaining(["noopener", "noreferrer"]),
      );
      expect(link.getAttribute("aria-label")).toMatch(/^Abrir /);
    }
  });

  it("traduce encabezados, secciones y citas al inglés", () => {
    localStorage.setItem("antares_lang", "en");
    renderPage();

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Medical sources and references",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "AI and telemedicine",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", {
        name: /Open Obesity and overweight · World Health Organization/,
      }),
    ).toBeTruthy();
  });

  it("abre la referencia en el navegador de Capacitor cuando está en un dispositivo", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    vi.mocked(Browser.open).mockResolvedValue(undefined);
    renderPage();

    const source = medicalSources[0].sources[0];
    const link = screen.getByRole("link", {
      name: /Abrir Obesidad y sobrepeso/,
    });
    expect(fireEvent.click(link)).toBe(false);
    expect(Browser.open).toHaveBeenCalledWith({
      url: source.url,
      presentationStyle: "popover",
    });
  });
});
