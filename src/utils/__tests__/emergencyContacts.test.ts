import { describe, expect, it } from "vitest";
import { emergencyContactsError, emptyEmergencyContact, trimEmergencyContact } from "../emergencyContacts";

const primary = { name: "Ana", relationship: "Madre", phone: "+573001234567", email: "ana@example.test" };
describe("two emergency contacts", () => {
  it("requires the primary contact even if the second is complete", () => {
    expect(emergencyContactsError(emptyEmergencyContact(), primary)).toBe("El contacto principal requiere nombre y teléfono.");
  });
  it("allows the second slot to stay entirely empty", () => {
    expect(emergencyContactsError(primary, emptyEmergencyContact())).toBeNull();
  });
  it("does not silently discard a half-filled optional contact", () => {
    expect(emergencyContactsError(primary, { ...emptyEmergencyContact(), email: "backup@example.test" })).toContain("segundo contacto");
  });
  it("accepts two complete contacts and rejects malformed emails", () => {
    expect(emergencyContactsError(primary, { ...primary, name: "Luis" })).toBeNull();
    expect(emergencyContactsError(primary, { ...primary, email: "broken" })).toContain("correo");
  });
  it("trims names and contact details before persistence", () => {
    expect(trimEmergencyContact({ ...primary, name: " Ana ", phone: " +573001234567 " })).toEqual(primary);
  });
});
