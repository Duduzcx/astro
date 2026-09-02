/**
 * Fundo de cor numa única camada fixa: um gradiente parado mais três manchas
 * borradas. As manchas só animam a partir de lg; no celular ficam paradas,
 * senão o scroll engasga.
 */
export function AuroraBlobs() {
  return (
    <div aria-hidden="true" className="fixed inset-0 z-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(1200px 800px at 80% -10%, rgba(77, 132, 224, 0.13), transparent 60%),' +
            'radial-gradient(1000px 700px at 0% 45%, rgba(90, 143, 232, 0.08), transparent 60%),' +
            'radial-gradient(900px 700px at 100% 90%, rgba(122, 179, 255, 0.07), transparent 60%)',
        }}
      />
      <div className="absolute top-[-12%] left-[8%] h-[46vh] w-[42vw] rounded-full bg-cobalt/12 blur-[90px] will-change-transform lg:animate-[astro-blob-a_26s_ease-in-out_infinite]" />
      <div className="absolute right-[-6%] bottom-[6%] h-[42vh] w-[38vw] rounded-full bg-[#8db4f5]/10 blur-[90px] will-change-transform lg:animate-[astro-blob-b_31s_ease-in-out_infinite]" />
      <div className="absolute top-[38%] left-[52%] h-[36vh] w-[30vw] rounded-full bg-[#5a8fe8]/10 blur-[90px] will-change-transform lg:animate-[astro-blob-a_37s_ease-in-out_infinite_reverse]" />
    </div>
  )
}
