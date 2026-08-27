import AppMark from "./AppMark";
import type { Brand } from "@/lib/tenant";

/**
 * The mark pressed into the middle of the cloth, the way the old table carried
 * its logo. A brand with its own logo gets that image, softly set into the felt;
 * otherwise the generic poker-chip mark is engraved - a dark copy sunk in and a
 * light one nudged down a pixel so the edge catches the light.
 */
export default function FeltEmblem({ brand }: { brand?: Brand }) {
  if (brand?.logo_url) {
    const mask = { WebkitMaskImage: `url("${brand.logo_url}")`, maskImage: `url("${brand.logo_url}")` };
    // Two masked layers - a dark recess and a light lip nudged down - so the
    // brand mark is stamped into the felt exactly like the default emblem,
    // colourless, rather than laid on top as a flat coloured image.
    return (
      <div className="pointer-events-none absolute left-1/2 top-1/2 aspect-square h-[38%] -translate-x-1/2 -translate-y-1/2">
        <div className="felt-emblem-mask-lip" style={mask} />
        <div className="felt-emblem-mask" style={mask} />
      </div>
    );
  }
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 h-[42%] -translate-x-1/2 -translate-y-1/2">
      <div className="relative h-full">
        <AppMark className="felt-emblem-lip absolute inset-0 h-full w-auto" />
        <AppMark className="felt-emblem h-full w-auto" />
      </div>
    </div>
  );
}
