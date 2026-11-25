import brandSymbol from "../assets/LogoIndividual.png";
import { BRAND_NAME } from "../utils/brand";

export function BrandWordmark({ className }: { className: string }) {
  return (
    <div className={className}>
      <img src={brandSymbol} alt="" />
      <strong>{BRAND_NAME}</strong>
    </div>
  );
}
