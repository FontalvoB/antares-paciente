import { vi, it, expect, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, fireEvent, screen, waitFor } from "@testing-library/react";
import { CameraCapture } from "../CameraCapture";
import { I18nProvider } from "../../i18n/I18nContext";
// Happy-dom no implementa la cancelación WAAPI de los cambios de escena.
// La física se verifica en navegador; aquí comprobamos captura y confirmación.
vi.mock("framer-motion", async (original) => ({
  ...(await original<typeof import("framer-motion")>()),
  useReducedMotion: () => true,
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, className }: { children: ReactNode; className?: string }) => <div className={className}>{children}</div>,
    span: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  },
}));
const native = vi.hoisted(() => ({ value: false, getPhoto: vi.fn() }));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => native.value },
}));
vi.mock("@capacitor/camera", () => ({
  Camera: { getPhoto: native.getPhoto },
  CameraSource: { Camera: "CAMERA", Photos: "PHOTOS" },
  CameraResultType: { DataUrl: "dataUrl" },
}));
beforeEach(() => {
  native.value = false;
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});
it("requires confirmation, discards without uploading and allows selecting the same file again", () => {
  const capture = vi.fn();
  const { container } = render(
    <I18nProvider>
      <CameraCapture onCapture={capture} onCancel={() => {}} />
    </I18nProvider>,
  );
  const file = new File(["photo"], "meal.jpg", { type: "image/jpeg" });
  fireEvent.change(container.querySelector("[data-gallery-input]")!, {
    target: { files: [file] },
  });
  expect(capture).not.toHaveBeenCalled();
  expect(screen.getByText("Revisa tu foto")).toBeTruthy();
  fireEvent.click(screen.getByText("Descartar foto"));
  expect(capture).not.toHaveBeenCalled();
  fireEvent.change(container.querySelector("[data-gallery-input]")!, {
    target: { files: [file] },
  });
  fireEvent.click(screen.getByText("Usar foto y analizar"));
  expect(capture).toHaveBeenCalledWith(file, "meal.jpg");
});
it("native retake opens camera again and never analyzes the discarded photo", async () => {
  native.value = true;
  native.getPhoto.mockResolvedValue({ dataUrl: "data:image/jpeg;base64,YWJj" });
  const capture = vi.fn();
  render(
    <I18nProvider>
      <CameraCapture
        autoSource="camera"
        onCapture={capture}
        onCancel={() => {}}
      />
    </I18nProvider>,
  );
  await waitFor(() => expect(screen.getByText("Revisa tu foto")).toBeTruthy());
  fireEvent.click(screen.getByText("Volver a tomar foto"));
  await waitFor(() => expect(native.getPhoto).toHaveBeenCalledTimes(2));
  expect(capture).not.toHaveBeenCalled();
});
