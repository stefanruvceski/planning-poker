import LogoMark from "./LogoMark";
import type { Brand } from "@/lib/tenant";

/**
 * A brand's logo: its uploaded image when it has one, otherwise the default
 * planning-poker mark. Square, sized by the caller via className.
 */
export default function BrandLogo({ brand, className = "" }: { brand: Brand; className?: string }) {
  if (brand.logo_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={brand.logo_url}
        alt={brand.name}
        className={`object-contain ${className}`}
      />
    );
  }
  return <LogoMark className={`text-[#e9453c] ${className}`} />;
}
