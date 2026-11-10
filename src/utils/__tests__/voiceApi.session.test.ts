import { beforeEach, describe, expect, it, vi } from "vitest";
import { consentFailure } from "../legalConsents";
import { toolRequestAppointment } from "../voiceApi";
const api = vi.hoisted(() => ({ context: vi.fn(), create: vi.fn() }));
vi.mock("../appointmentsApi", () => ({ fetchMyContext: api.context, createRequest: api.create }));
const token = (owner: string) => `header.${btoa(JSON.stringify({ sub: owner }))}.signature`;
const context = (owner: string) => ({ patient: { id: `${owner}-patient`, organizationId: `${owner}-org` } });
const args = { specialty_id: "synthetic-specialty", reason: "synthetic request" };

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  localStorage.setItem("copp_access_token", token("owner-a"));
  api.context.mockReset(); api.create.mockReset();
  api.create.mockResolvedValue({ id: "synthetic-request", status: "Pending" });
});
describe("voice appointment context ownership", () => {
  it("never reuses a prior account's patient or organization context", async () => {
    api.context.mockResolvedValueOnce(context("owner-a")).mockResolvedValueOnce(context("owner-b"));
    await toolRequestAppointment(args);
    localStorage.setItem("copp_access_token", token("owner-b"));
    await toolRequestAppointment(args);
    expect(api.context).toHaveBeenCalledTimes(2);
    expect(api.create.mock.calls.map(call => call[0].patientId)).toEqual(["owner-a-patient", "owner-b-patient"]);
  });

  it("account switching while context loads cannot issue an appointment write", async () => {
    let finish!: (value: ReturnType<typeof context>) => void;
    api.context.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const request = toolRequestAppointment(args);
    const refused = expect(request).rejects.toMatchObject({ code: "CONSENT_CANCELLED" });
    localStorage.setItem("copp_access_token", token("owner-b"));
    finish(context("owner-a"));
    await refused;
    expect(api.create).not.toHaveBeenCalled();
  });

  it("closing or withdrawing while context loads cannot issue an appointment write", async () => {
    let active = true;
    const guard = () => { if (!active) throw consentFailure("CONSENT_CANCELLED"); };
    let finish!: (value: ReturnType<typeof context>) => void;
    api.context.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const request = toolRequestAppointment(args, guard);
    const refused = expect(request).rejects.toMatchObject({ code: "CONSENT_CANCELLED" });
    active = false; finish(context("owner-a"));
    await refused;
    expect(api.create).not.toHaveBeenCalled();
  });
});
