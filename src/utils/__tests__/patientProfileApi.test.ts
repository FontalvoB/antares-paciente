import { beforeEach, describe, expect, it, vi } from "vitest";
import { toUserProfile, updateMyPatientProfile, type PatientSelfProfileDto } from "../patientProfileApi";

const request = vi.hoisted(() => vi.fn());
vi.mock("../apiClient", () => ({ apiFetch: request, ApiError: class extends Error {} }));
const dto: PatientSelfProfileDto = { patientId: "patient", firstName: "Ana", lastName: "Prueba", documentNumber: "test", dateOfBirth: null, email: "patient@example.test", phone: "+573001234567", emergencyName: "Primero", emergencyRelationship: "Madre", emergencyPhone: "+573001234568", emergencyEmail: "primary@example.test", insurerId: null, memberId: "" };
beforeEach(() => request.mockResolvedValue(dto));
describe("patient profile contact contract", () => {
  it("loads the optional second contact while preserving the SOS primary", () => {
    const user = toUserProfile({ ...dto, secondaryEmergencyContact: { name: "Segundo", relationship: "Hermano/a", phone: "+12025550123", email: "backup@example.test" } });
    expect(user.fam1Nombre).toBe("Primero");
    expect(user.fam2Nombre).toBe("Segundo");
    expect(user.fam2Cel).toBe("+12025550123");
    expect(toUserProfile(dto).fam2Nombre).toBe("");
  });
  it("persists two contact slots and explicit no-insurance selection", async () => {
    const second = { name: "Segundo", relationship: "Hermano/a", phone: "+12025550123", email: "" };
    await updateMyPatientProfile({ dateOfBirth: null, email: dto.email, phone: dto.phone, emergencyName: dto.emergencyName, emergencyRelationship: dto.emergencyRelationship, emergencyPhone: dto.emergencyPhone, emergencyEmail: dto.emergencyEmail, secondaryEmergencyContact: second, insurerId: null, memberId: "" });
    expect(request).toHaveBeenCalledWith("/api/v1/me/patient-profile", expect.objectContaining({ method: "PUT", body: expect.objectContaining({ emergencyName: "Primero", secondaryEmergencyContact: second, insurerId: null, clearInsurer: true }) }));
  });
});
