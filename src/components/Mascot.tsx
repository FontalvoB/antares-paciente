import idleSrc from "../assets/mascot/copp-dog-idle.png";
import welcomeSrc from "../assets/mascot/copp-dog-welcome.png";
import pointingSrc from "../assets/mascot/copp-dog-pointing.png";
import thinkingSrc from "../assets/mascot/copp-dog-thinking.png";
import successSrc from "../assets/mascot/copp-dog-success.png";
import markSrc from "../assets/LogoIndividual.png";

const poseSources = {
  idle: idleSrc,
  welcome: welcomeSrc,
  pointing: pointingSrc,
  thinking: thinkingSrc,
  success: successSrc,
} as const;

export type MascotPose = keyof typeof poseSources;

/**
 * Mascota COPP-ADRESD (el perro de la web). Ilustración decorativa con la
 * insignia de marca sobre el pecho — mismas proporciones que la web
 * (`Mascot.tsx` del sitio). El tamaño lo fija la clase contextual.
 */
export function Mascot({
  pose,
  className = "",
  float = true,
}: {
  pose: MascotPose;
  className?: string;
  /** Desactiva la animación de flotado (útil junto a texto estático). */
  float?: boolean;
}) {
  return (
    <div
      className={`mascot mascot-${pose}${float ? "" : " no-float"}${className ? ` ${className}` : ""}`}
      aria-hidden="true"
    >
      <img className="mascot-character" src={poseSources[pose]} alt="" decoding="async" />
      <img className="mascot-mark" src={markSrc} alt="" />
    </div>
  );
}
