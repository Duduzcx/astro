import { motion } from 'framer-motion'
import { GiantWord, Label, Reveal, WordReveal } from './ui/Primitives'

/**
 * Lista do anexo "Dicionário de Entregáveis": o que é transferido para o
 * cliente no encerramento do projeto.
 */
const deliverables = [
  {
    title: 'Código e repositório',
    body: 'Acesso de administrador com todo o histórico. 100% da propriedade intelectual é sua, formalizada em termo de cessão.',
  },
  {
    title: 'Hospedagem e banco de dados',
    body: 'Deploy em produção com acesso mestre transferido pro seu nome — chaves entregues por canal seguro.',
  },
  {
    title: 'Integrações documentadas',
    body: 'Pagamentos, WhatsApp, CRM — cada chave e token no seu nome, com inventário de onde está e como renovar.',
  },
  {
    title: 'Métricas e marketing',
    body: 'Google Analytics 4, Search Console, Tag Manager e pixels de conversão configurados desde o primeiro dia.',
  },
  {
    title: 'Performance auditada',
    body: 'SEO técnico, Core Web Vitals e acessibilidade comprovados por relatório oficial do Google Lighthouse.',
  },
  {
    title: 'Documentação completa',
    body: 'Readme técnico pra qualquer dev do futuro e manual operacional pra sua equipe do dia a dia.',
  },
  {
    title: 'Treinamento da equipe',
    body: 'Sessão ao vivo, vídeos gravados e acompanhamento nas primeiras semanas — seu time opera sozinho.',
  },
  {
    title: 'Jurídico e LGPD',
    body: 'Termos de uso, política de privacidade, NDA e adequação à LGPD publicados junto com o site.',
  },
  {
    title: 'Garantia técnica',
    body: 'Termo de Aceite formal e SLA de 30 a 90 dias contra falhas ocultas, definido em contrato.',
  },
] as const

export function Deliverables() {
  return (
    <section
      id="entregaveis"
      aria-label="O que você recebe"
      className="relative z-10 overflow-hidden py-24 md:py-32"
    >
      <GiantWord word="Seu" className="opacity-60" />
      <div className="shell relative">
        <Label>Evidência, não promessa</Label>
        <WordReveal
          text="O que você leva quando o projeto fecha"
          className="font-impact mt-6 max-w-3xl text-[clamp(2.4rem,5.2vw,4.2rem)]"
        />
        <Reveal delay={0.12}>
          <p className="mt-5 max-w-lg text-ash">
            Todo projeto sai com um dicionário de entregáveis anexado ao contrato: cada acesso,
            documento e garantia transferido pra sua propriedade. Você não fica refém de ninguém —
            nem da gente.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {deliverables.map((item, index) => (
            <Reveal key={item.title} delay={0.05 * index}>
              <article className="graphite-card h-full">
                <div className="flex items-center gap-3">
                  {/* O check se desenha quando o card entra na tela. */}
                  <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4 shrink-0">
                    <motion.path
                      d="M2.5 8.5 6 12l7.5-8"
                      fill="none"
                      stroke="#8db4f5"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0 }}
                      whileInView={{ pathLength: 1 }}
                      viewport={{ once: true, margin: '-40px' }}
                      transition={{ duration: 0.5, delay: 0.2 + 0.05 * index, ease: 'easeOut' }}
                    />
                  </svg>
                  <h3 className="text-[1.05rem]">{item.title}</h3>
                </div>
                <p className="mt-3 text-[14px] leading-[1.55] text-ash">{item.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
