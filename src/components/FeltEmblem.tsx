import LogoMark from "./LogoMark";
import type { Brand } from "@/lib/tenant";

/**
 * The mark pressed into the middle of the cloth, the way the old table carried
 * its logo. A brand with its own logo gets that image, softly set into the felt;
 * otherwise the default planning-poker shape is engraved - a dark copy sunk in
 * and a light one nudged down a pixel so the edge catches the light.
 */
export default function FeltEmblem({ brand }: { brand?: Brand }) {
  if (brand?.logo_url) {
    return (
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[38%] -translate-x-1/2 -translate-y-1/2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={brand.logo_url}
          alt=""
          className="h-full w-auto object-contain opacity-25 mix-blend-luminosity"
        />
      </div>
    );
  }
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 h-[42%] -translate-x-1/2 -translate-y-1/2">
      <div className="relative h-full">
        <LogoMark className="felt-emblem-lip absolute inset-0 h-full w-auto" />
        <LogoMark className="felt-emblem h-full w-auto" />
      </div>
    </div>
  );
}
