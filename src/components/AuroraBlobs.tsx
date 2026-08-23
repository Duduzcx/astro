/**
 * The living background: three blurred colour blobs drifting very slowly
 * behind everything. Reduced-motion users get them static (global CSS kills
 * the animation), which still colours the page.
 */
export function AuroraBlobs() {
  return (
    <div aria-hidden="true" className="fixed inset-0 z-0 overflow-hidden">
      <div className="absolute top-[-12%] left-[8%] h-[46vh] w-[42vw] animate-[astro-blob-a_26s_ease-in-out_infinite] rounded-full bg-cobalt/14 blur-[130px]" />
      <div className="absolute right-[-6%] bottom-[6%] h-[42vh] w-[38vw] animate-[astro-blob-b_31s_ease-in-out_infinite] rounded-full bg-[#4dd6e8]/10 blur-[130px]" />
      <div className="absolute top-[38%] left-[52%] h-[36vh] w-[30vw] animate-[astro-blob-a_37s_ease-in-out_infinite_reverse] rounded-full bg-[#8b7cf8]/12 blur-[130px]" />
    </div>
  )
}
