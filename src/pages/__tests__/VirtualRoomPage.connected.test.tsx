import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { VirtualRoomPage } from "../VirtualRoomPage";

const state = vi.hoisted(() => ({ room: null as any, join: vi.fn() }));
vi.mock("../../context/AppContext", () => ({ useApp: () => ({
  roomAppointment: { id: "qa", name: "Lucía", motivo: "Consulta", time: "10:00", day: "Hoy", status: "InProgress" },
  user: {nombre: "Paciente QA"}, closeRoom: vi.fn(), navigate: vi.fn(),
}) }));
vi.mock("../../i18n/I18nContext", () => ({useT: () => (s: string) => s, useI18n: () => ({lang: "es"})}));
vi.mock("../../utils/appointmentsApi", () => ({
  fetchJoinToken: () => state.join(), fetchAppointmentRoom: vi.fn(async () => ({participants: [{identity:"professional",displayName:"Mauricio",role:"Professional"},{identity:"supervisor",displayName:"Supervisor QA",role:"Supervisor"}]})),
  ApiClientError: class extends Error {},
}));
vi.mock("../../utils/roomMedia", async importOriginal => ({
  ...(await importOriginal<object>()), initialMediaProbe: () => ({camera: "ready", microphone: "ready"}),
}));
vi.mock("../../components/RoomChatPanel", () => ({RoomChatPanel: () => null}));
vi.mock("../../components/PreVisitIntakeSheet", () => ({PreVisitIntakeSheet: () => null}));

function track(kind: string, enabled = true) {
  const events = new Map<string, () => void>();
  const media = document.createElement(kind === "video" ? "video" : "audio");
  return {kind, isEnabled: enabled, attach: vi.fn(() => media), detach: () => [media], stop: vi.fn(),
    enable: vi.fn(), disable: vi.fn(), restart: vi.fn(async () => {}),
    mediaStreamTrack: {getSettings: () => ({facingMode: "user"})},
    on: (event: string, fn: () => void) => events.set(event, fn), off: (event: string) => events.delete(event), events};
}
let remote: ReturnType<typeof track>, local: ReturnType<typeof track>;
beforeEach(() => {
  remote = track("video", false); local = track("video");
  const audio = track("audio");
  const participant = (identity: string, tracks: any[]) => ({identity,
    tracks: new Map(tracks.map((t, i) => [String(i), {track: t}])),
    videoTracks: new Map(tracks.filter(t => t.kind === "video").map(t => ["v", {track: t}])),
    audioTracks: new Map(tracks.filter(t => t.kind === "audio").map(t => ["a", {track: t}])), on: vi.fn()});
  state.room = {localParticipant: participant("patient", [local, audio]),
    participants: new Map([["professional", participant("professional", [remote])]]), on: vi.fn(), disconnect: vi.fn()};
  state.join.mockResolvedValue({token: "qa-token"});
  (window as any).Twilio = {Video: {connect: vi.fn(async () => state.room)}};
  const script = document.createElement("script"); script.type = "application/json"; script.src = "https://sdk.twilio.com/js/video/releases/2.36.0/twilio-video.min.js";
  document.head.appendChild(script);
});

it("attaches early tracks and clears a disabled-camera placeholder after remote camera enables", async () => {
  const {container} = render(<VirtualRoomPage />);
  fireEvent.click(screen.getByText("Entrar a la consulta"));
  await waitFor(() => expect(container.querySelector(".room-remote-person[data-participant=professional] video")).toBeTruthy());
  expect(container.querySelector(".room-remote-person[data-participant=professional] .room-tile-initials")).toBeTruthy();
  act(() => { remote.isEnabled = true; remote.events.get("enabled")?.(); });
  expect(container.querySelector(".room-remote-person[data-participant=professional] .room-tile-initials")).toBeNull();
  fireEvent.click(screen.getByLabelText("Cambiar video principal"));
  expect(container.querySelector(".room-local-main")).toBeTruthy();
  expect(remote.attach).toHaveBeenCalledOnce();
});

it("flips the camera through the existing published track and preserves camera-off state", async () => {
  render(<VirtualRoomPage />); fireEvent.click(screen.getByText("Entrar a la consulta"));
  await screen.findByLabelText("Apagar cámara");
  fireEvent.click(screen.getByLabelText("Apagar cámara"));
  fireEvent.click(screen.getByLabelText("Cambiar cámara"));
  await waitFor(() => expect(local.restart).toHaveBeenCalledWith({facingMode: "environment"}));
  expect(local.disable).toHaveBeenCalled();
  expect(screen.getByLabelText("Encender cámara")).toBeTruthy();
});

it("keeps three participants' cameras, labels and main-video selection separate", async () => {
  const professional = state.room.participants.get("professional");
  const supervisorTrack = track("video");
  const supervisor = {identity: "supervisor", tracks: new Map([["v", {track: supervisorTrack}]]), on: vi.fn()};
  state.room.participants = new Map([["supervisor", supervisor], ["professional", professional]]);
  const {container} = render(<VirtualRoomPage />);
  fireEvent.click(screen.getByText("Entrar a la consulta"));
  await screen.findByText("Mauricio");
  const professionalTile = container.querySelector('[data-participant="professional"]')!;
  const supervisorTile = container.querySelector('[data-participant="supervisor"]')!;
  expect(professionalTile.contains(remote.attach.mock.results[0].value)).toBe(true);
  expect(supervisorTile.contains(supervisorTrack.attach.mock.results[0].value)).toBe(true);
  expect(professionalTile.classList.contains("room-person-main")).toBe(true);
  expect(supervisorTile.textContent).toContain("Supervisor QA");
  fireEvent.click(screen.getByLabelText("Ampliar video de {name}"));
  expect(supervisorTile.classList.contains("room-person-main")).toBe(true);
  expect(professionalTile.contains(remote.attach.mock.results[0].value)).toBe(true);
  expect(supervisorTrack.attach).toHaveBeenCalledOnce();
});
