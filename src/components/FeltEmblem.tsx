import LogoMark from "./LogoMark";

/**
 * The mark pressed into the middle of the cloth, the way the old table carried
 * its logo. The engraving is two copies of the same shape: a dark one sunk into
 * the felt and a light one nudged down a pixel, so the edge catches the light
 * from above the table.
 */
export default function FeltEmblem() {
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 h-[42%] -translate-x-1/2 -translate-y-1/2">
      <div className="relative h-full">
        <LogoMark className="felt-emblem-lip absolute inset-0 h-full w-auto" />
        <LogoMark className="felt-emblem h-full w-auto" />
      </div>
    </div>
  );
}
