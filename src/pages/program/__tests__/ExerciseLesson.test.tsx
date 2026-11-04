import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { ExerciseLesson } from "../ExerciseLesson";
import { exerciseMediaUrl } from "../../../utils/exerciseMedia";
import type { ExerciseItemDto } from "../../../services/program/types";

vi.mock("@ionic/react", () => ({
  IonButton: ({ children, onClick }: { children: ReactNode; onClick: () => void }) => <button onClick={onClick}>{children}</button>,
  IonItem: ({ children, onClick }: { children: ReactNode; onClick: () => void }) => <button onClick={onClick}>{children}</button>,
  IonIcon: () => null,
  IonSpinner: () => null,
  IonChip: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  IonAccordion: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  IonAccordionGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  IonLabel: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  IonList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  IonProgressBar: () => null,
}));
vi.mock("../../../i18n/I18nContext", () => ({ useT: () => (key: string, parameters?: Record<string, string>) =>
  Object.entries(parameters ?? {}).reduce((value, [name, text]) => value.replace(`{${name}}`, text), key) }));

afterEach(cleanup);
const exercise: ExerciseItemDto = {
  name: "Movimiento prescrito", description: "Instrucción real del profesional", sets: 3,
  repetitions: 10, restSeconds: 30, durationSecs: 60, sortOrder: 0,
  targetMuscle: "Piernas", equipment: "Silla", tips: "Técnica indicada por el equipo",
  mediaId: "configured-media", mediaType: "Video", mediaUrl: "https://media.example/exercise.mp4?sig=signed",
  weightKg: 2, tempo: "2-1-2", rpe: 4,
};
function setup(overrides: Record<string, unknown> = {}) {
  const props = { done: false, pts: 50, title: "Rutina asignada", exercises: [exercise],
    step: 0, left: 60, running: false, onToggle: vi.fn(), onSkip: vi.fn(), onComplete: vi.fn(), ...overrides };
  const result = render(<ExerciseLesson {...props} />);
  return { ...result, props };
}

describe("exercise routine and dedicated technique view", () => {
  it("opens the selected exercise with its configured video and actual prescription", () => {
    const { container, props } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Ver mis indicaciones" }));
    expect(screen.getByRole("heading", { name: "Movimiento prescrito" })).toBeTruthy();
    const video = container.querySelector("video")!;
    expect(video.getAttribute("src")).toBe(exercise.mediaUrl);
    expect(video.controls).toBe(true);
    expect(video.autoplay).toBe(false);
    expect(screen.getByText(exercise.tips!)).toBeTruthy();
    expect(screen.getByText("2-1-2")).toBeTruthy();
    expect(props.onComplete).not.toHaveBeenCalled();
  });
  it("pauses the running circuit before inspecting a demonstration and returns without completing", () => {
    const { props } = setup({ running: true });
    fireEvent.click(screen.getByRole("button", { name: "Ver mis indicaciones" }));
    expect(props.onToggle).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Volver a mi rutina" }));
    expect(screen.getByRole("heading", { name: "Rutina asignada" })).toBeTruthy();
    expect(props.onComplete).not.toHaveBeenCalled();
  });
  it("shows the selected exercise image rather than another station's demonstration", () => {
    const image = { ...exercise, name: "Segundo movimiento", sortOrder: 1, mediaType: "Image" as const, mediaUrl: "https://media.example/second.png" };
    const { container } = setup({ exercises: [exercise, image] });
    fireEvent.click(screen.getByRole("button", { name: "Ver técnica y demostración" }));
    expect(container.querySelector("video")).toBeNull();
    expect(screen.getByRole("img").getAttribute("src")).toBe(image.mediaUrl);
  });
  it("never invents media when the team has not assigned one", () => {
    const { container } = setup({ exercises: [{ ...exercise, mediaUrl: null }] });
    fireEvent.click(screen.getByRole("button", { name: "Ver mis indicaciones" }));
    expect(screen.getByText("Demostración no disponible")).toBeTruthy();
    expect(container.querySelector("video, img")).toBeNull();
  });
  it("has a retry state when the configured video fails", () => {
    const { container } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Ver mis indicaciones" }));
    fireEvent.error(container.querySelector("video")!);
    expect(screen.getByRole("alert")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(container.querySelector("video")).not.toBeNull();
  });
  it("requires the deliberate completion callback and hides completion action once done", () => {
    const { props } = setup();
    fireEvent.click(screen.getByRole("button", { name: /Ya lo hice/ }));
    expect(props.onComplete).toHaveBeenCalledOnce();
    cleanup(); setup({ done: true });
    expect(screen.queryByRole("button", { name: /Ya lo hice/ })).toBeNull();
    expect(screen.getByText("Rutina de hoy completada")).toBeTruthy();
  });
  it("shows the unavailable state without enabling completion", () => {
    const { props } = setup({ exercises: [] });
    expect(screen.getByText("Rutina no disponible")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(props.onComplete).not.toHaveBeenCalled();
  });
});

describe("exercise media URL safety", () => {
  it.each(["javascript:alert(1)", "data:image/svg+xml,<svg/>", "file:///private", "https://user:password@example.com/demo.mp4", "/unresolved/storage/key"])("rejects %s", (value) => {
    expect(exerciseMediaUrl(value)).toBeNull();
  });
  it("keeps signed HTTPS URLs and development HTTP URLs intact", () => {
    expect(exerciseMediaUrl(exercise.mediaUrl)).toBe(exercise.mediaUrl);
    expect(exerciseMediaUrl("http://10.0.2.2:5122/api/v1/storage/demo.mp4?exp=1&sig=abc")).toContain("sig=abc");
  });
});
