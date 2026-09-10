import { useEffect, useState } from "react";
import { applyTabletLayoutClass, isTabletLayout } from "../utils/viewport";

/**
 * Marca `<html>` con `is-tablet` cuando el viewport es un iPad/tablet,
 * y lo actualiza al rotar o redimensionar.
 */
export function useTabletLayout(): boolean {
  const [tablet, setTablet] = useState(() => isTabletLayout());

  useEffect(() => {
    const sync = () => {
      setTablet(applyTabletLayoutClass());
    };
    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, []);

  return tablet;
}
