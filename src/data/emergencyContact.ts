/**
 * Parentescos del contacto de emergencia: misma lista en onboarding
 * (PRIMERA captura) y en Perfil (edición posterior). El valor se guarda tal
 * cual en `patient_profiles.emergency_contact.relationship` (texto libre del
 * ERP): no traducir en el almacenamiento.
 */
export const PARENTESCO = [
  "Esposo/a",
  "Padre/Madre",
  "Cuidador/a",
  "Hijo/a",
  "Hermano/a",
  "Amigo/a",
] as const;
