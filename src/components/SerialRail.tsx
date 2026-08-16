/**
 * Edge branding. Reads as a serial number stamped on the side of a physical unit —
 * the one piece of chrome allowed to sit outside the content column.
 */
export function SerialRail({ text }: { text: string }) {
  return (
    <div className="pointer-events-none fixed top-1/2 right-0 z-40 hidden -translate-y-1/2 xl:block">
      <span
        className="label-voice block text-[10px] whitespace-nowrap"
        style={{ writingMode: 'vertical-rl' }}
      >
        {text}
      </span>
    </div>
  )
}
