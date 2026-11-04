import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ConsentReadGate } from "../ConsentReadGate";

vi.mock("../../i18n/I18nContext", () => ({ useT: () => (key: string) => key }));
beforeEach(cleanup);
function geometry(region: HTMLElement, top: number, height = 180, full = 400) {
  Object.defineProperties(region, { scrollTop: { value: top, configurable: true }, clientHeight: { value: height, configurable: true }, scrollHeight: { value: full, configurable: true } });
}
describe("informed consent reading", () => {
  it("keeps acceptance locked until the actual end is visible", () => {
    const read = vi.fn();
    render(<ConsentReadGate onRead={read}><p>Actual consent document</p></ConsentReadGate>);
    const region = screen.getByRole("region");
    expect(read).not.toHaveBeenCalled();
    geometry(region, 100);
    fireEvent.scroll(region);
    expect(read).not.toHaveBeenCalled();
    geometry(region, 220);
    fireEvent.scroll(region);
    expect(read).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Ya puedes aceptar el consentimiento.")).toBeTruthy();
    fireEvent.scroll(region);
    expect(read).toHaveBeenCalledTimes(1);
  });
  it("allows acceptance when a short document is entirely visible", () => {
    const read = vi.fn();
    render(<ConsentReadGate onRead={read}>Short consent</ConsentReadGate>);
    const region = screen.getByRole("region");
    geometry(region, 0, 180, 100);
    fireEvent.scroll(region);
    expect(read).toHaveBeenCalledOnce();
  });
});
