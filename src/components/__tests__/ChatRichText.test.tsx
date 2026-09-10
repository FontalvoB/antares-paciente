import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { ChatRichText } from "../ChatRichText";

describe("ChatRichText", () => {
  it("texto plano sin marcas se pinta igual", () => {
    render(<ChatRichText text="Hola, ¿cómo estás?" />);
    expect(screen.getByText("Hola, ¿cómo estás?")).toBeTruthy();
  });

  it("negrita, cursiva y código", () => {
    const { container } = render(
      <ChatRichText text="Toma **dos** pastillas *hoy* y mide `HbA1c`" />,
    );
    expect(container.querySelector("strong.md-b")?.textContent).toBe("dos");
    expect(container.querySelector("em.md-i")?.textContent).toBe("hoy");
    expect(container.querySelector("code.md-code")?.textContent).toBe("HbA1c");
  });

  it("listas con guion y numeradas", () => {
    const { container } = render(
      <ChatRichText text={"- Manzana\n- Avena\n\n1. Cena\n2. Dormir"} />,
    );
    expect(container.querySelectorAll("ul.md-list li")).toHaveLength(2);
    expect(container.querySelectorAll("ol.md-list li")).toHaveLength(2);
  });

  it("enlaces externos con rel seguro", () => {
    const { container } = render(
      <ChatRichText text="Ver [guía](https://ejemplo.com/x)" />,
    );
    const a = container.querySelector("a.md-link");
    expect(a?.getAttribute("href")).toBe("https://ejemplo.com/x");
    expect(a?.getAttribute("rel")).toBe("noreferrer");
  });

  it("sin texto muestra indicador escribiendo, no burbuja vacía", () => {
    const { container } = render(<ChatRichText text="" />);
    expect(container.querySelector(".typing")).toBeTruthy();
  });

  it("no inyecta HTML crudo (XSS)", () => {
    const { container } = render(
      <ChatRichText text={"<img src=x onerror=alert(1)> **ok**"} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("strong.md-b")?.textContent).toBe("ok");
  });
});
