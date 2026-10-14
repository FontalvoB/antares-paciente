import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RoomChatPanel } from "../RoomChatPanel";
const api = vi.hoisted(() => ({ load: vi.fn(), send: vi.fn() }));
vi.mock("../../utils/appointmentsApi", () => ({ fetchRoomChatMessages: api.load, sendRoomChatMessage: api.send, ApiClientError: class extends Error {} }));
vi.mock("../../i18n/I18nContext", () => ({ useT: () => (key: string) => key, useI18n: () => ({ lang: "es" }) }));
vi.mock("@ionic/react", () => ({
  IonModal: ({children}: {children: React.ReactNode}) => <div>{children}</div>,
  IonIcon: () => null, IonSpinner: () => null,
  IonButton: ({children, onClick, disabled, "aria-label": label}: {children: React.ReactNode; onClick: () => void; disabled?: boolean; "aria-label"?: string}) => <button onClick={onClick} disabled={disabled} aria-label={label}>{children}</button>,
  IonTextarea: ({value, onIonInput, disabled, placeholder}: {value: string; onIonInput: (event: {detail: {value: string}}) => void; disabled: boolean; placeholder: string}) => <textarea value={value} disabled={disabled} placeholder={placeholder} onChange={event => onIonInput({detail: {value: event.target.value}})} />,
}));
beforeEach(() => { vi.clearAllMocks(); api.load.mockResolvedValue([]); });
it("shows the welcome state only while empty and sends a real appointment message", async () => {
  api.send.mockResolvedValue({id: "saved-1", appointmentId: "appt", senderUserId: "patient", senderRole: "Patient", body: "Hola", createdAt: new Date().toISOString()});
  render(<RoomChatPanel appointmentId="appt" enabled onClose={() => {}} />);
  await screen.findByText("Un espacio para conversar");
  expect(screen.queryByText("Chat de prueba")).toBeNull();
  expect(api.load).toHaveBeenCalledWith("appt", undefined);
  fireEvent.change(screen.getByPlaceholderText("Escribe un mensaje…"), {target: {value: "Hola"}});
  fireEvent.click(screen.getByLabelText("Enviar mensaje"));
  await waitFor(() => expect(api.send).toHaveBeenCalledWith("appt", "Hola"));
  await waitFor(() => expect(screen.getAllByText("Hola")).toHaveLength(1));
  expect(screen.queryByText("Un espacio para conversar")).toBeNull();
});
it("renders the professional's persisted message instead of the empty state", async () => {
  api.load.mockResolvedValue([{id: "remote-1", appointmentId: "appt", senderUserId: "professional", senderRole: "Professional", body: "Te escucho", createdAt: new Date().toISOString()}]);
  render(<RoomChatPanel appointmentId="appt" enabled onClose={() => {}} />);
  await screen.findByText("Te escucho");
  expect(screen.queryByText("Un espacio para conversar")).toBeNull();
});
