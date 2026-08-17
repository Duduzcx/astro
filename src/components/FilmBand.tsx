import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { VideoPlate } from './scenes/VideoPlate'
import { Label, LineReveal } from './ui/Primitives'
import { media } from '../lib/media'

/**
 * Full-bleed cinematic break. The footage scales down as it passes, so the band
 * reads as a moving plate rather than as wallpaper stuck behind the page.
 */
export function FilmBand() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [1.18, 1.04, 1.18])
  const y = useTransform(scrollYProgress, [0, 1], ['-8%', '8%'])

  return (
    <section ref={ref} className="relative min-h-[86svh] overflow-hidden">
      <motion.div style={{ scale, y }} className="absolute inset-0">
        <VideoPlate src={media.circuitFlight} className="h-full w-full" objectPosition="60% 50%" />
      </motion.div>
      <div className="film-scrim pointer-events-none absolute inset-0" />

      <div className="relative z-10 flex min-h-[86svh] items-end pb-20 md:pb-28">
        <div className="shell">
          <Label>Em produção</Label>
          <LineReveal
            text={'Projeto só conta\nquando está no ar.'}
            className="mt-7 max-w-3xl text-[clamp(2.4rem,5.6vw,4.6rem)] leading-[1.03]"
          />
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-15%' }}
            transition={{ duration: 0.8, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 max-w-md text-[1.05rem] leading-[1.5] text-silver"
          >
            Entrega não é a apresentação de um protótipo. É o sistema rodando, com gente usando,
            monitorado e com quem responder quando algo quebra.
          </motion.p>
        </div>
      </div>
    </section>
  )
}
