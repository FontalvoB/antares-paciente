import type { UserProfile } from "../types";
import type { PatientEmergencyContact } from "./patientProfileApi";

export const emptyEmergencyContact = (): PatientEmergencyContact => ({ name: "", relationship: "", phone: "", email: "" });

export function contactFromProfile(user: UserProfile, slot: 1 | 2): PatientEmergencyContact {
  return slot === 1
    ? { name: user.fam1Nombre ?? "", relationship: user.fam1Parentesco ?? "", phone: user.fam1Cel ?? "", email: user.fam1Email ?? "" }
    : { name: user.fam2Nombre ?? "", relationship: user.fam2Parentesco ?? "", phone: user.fam2Cel ?? "", email: user.fam2Email ?? "" };
}

export function trimEmergencyContact(contact: PatientEmergencyContact): PatientEmergencyContact {
  return { name: contact.name.trim(), relationship: contact.relationship.trim(), phone: contact.phone.trim(), email: contact.email.trim() };
}

/** El segundo contacto puede estar vacío; si se empieza, necesita nombre y teléfono. */
export function emergencyContactsError(primary: PatientEmergencyContact, secondary: PatientEmergencyContact): string | null {
  const first = trimEmergencyContact(primary);
  const second = trimEmergencyContact(secondary);
  if (!first.name || !first.phone) return "El contacto principal requiere nombre y teléfono.";
  if (Object.values(second).some(Boolean) && (!second.name || !second.phone)) return "Completa el nombre y el teléfono del segundo contacto o déjalo vacío.";
  for (const contact of [first, second]) {
    if (contact.name.length > 200 || contact.relationship.length > 100 || contact.phone.length > 20) return "Revisa los datos de tus contactos de emergencia.";
    if (contact.phone && (!/^\+?[0-9().\s-]+$/.test(contact.phone) || (contact.phone.match(/\d/g)?.length ?? 0) < 7 || (contact.phone.match(/\d/g)?.length ?? 0) > 15)) return "Revisa los datos de tus contactos de emergencia.";
    if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) return "Revisa el correo de tus contactos de emergencia.";
  }
  return null;
}
