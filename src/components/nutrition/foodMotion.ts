/** Un único ritmo para el contenido; Ionic conserva la animación de sus modales. */
export const FOOD_SPRING = { type: "spring" as const, stiffness: 260, damping: 26 };
export const foodScene = (reduced: boolean | null) => ({
  initial: { opacity: 0, ...(reduced ? {} : { y: 16, scale: 0.98 }) },
  animate: { opacity: 1, ...(reduced ? {} : { y: 0, scale: 1 }) },
  exit: { opacity: 0, ...(reduced ? {} : { scale: 0.98 }) },
  transition: reduced ? { duration: 0.18 } : { ...FOOD_SPRING, opacity: { duration: 0.28 } },
});
