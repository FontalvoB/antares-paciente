/**
 * Punto de entrada directa de solicitud de cita (Decisión 5, REQ-APP-02).
 *
 * El Paso 1 del wizard ofrece ÚNICAMENTE estas especialidades; Nutrición,
 * Psicología y demás NO son entrada directa (acceso por remisión médica
 * tras la cita de Medicina General; el ERP conserva la visión completa).
 *
 * Fuente declarativa ÚNICA de la política: los códigos se comparan por
 * igualdad exacta contra el `code` del catálogo (`erp.specialties`) — sin
 * regex, sin coincidencia por nombre y sin lógica posicional. Cuando el
 * backend exponga la marca de entrada directa en `SpecialtyDto`, esta lista
 * se retira y el adapter filtra por ese campo (follow-up exec-backend).
 */
export const DIRECT_ENTRY_SPECIALTY_CODES: readonly string[] = [
  "FAMILY_MEDICINE",
  "URGENT_CARE",
];
