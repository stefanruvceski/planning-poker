/**
 * Emblem sunk into the middle of the cloth, the way the old table carried its
 * logo. Drawn inline so it costs no request and scales with the felt.
 */
export default function FeltEmblem() {
  return (
    <svg
      viewBox="0 0 200 112"
      aria-hidden="true"
      className="felt-emblem pointer-events-none absolute left-1/2 top-1/2 h-[38%] -translate-x-1/2 -translate-y-1/2"
    >
      <path
        d="M100 8c-11 20-34 33-34 52a19 19 0 0 0 31 14l-5 20h16l-5-20a19 19 0 0 0 31-14c0-19-23-32-34-52Z"
        fill="#0b2a15"
      />
      <text
        x="100"
        y="106"
        textAnchor="middle"
        fill="#0b2a15"
        fontSize="15"
        fontWeight="800"
        letterSpacing="2.5"
        fontFamily="Trebuchet MS, Segoe UI, sans-serif"
      >
        PLANNING POKER
      </text>
    </svg>
  );
}
