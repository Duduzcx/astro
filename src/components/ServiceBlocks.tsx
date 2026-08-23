import { LineReveal, Reveal } from './ui/Primitives'

/**
 * Reference pattern: tall screens where a single text column floats beside the
 * particle object. Copy on the right while the sphere sits left (TriScene keeps
 * it left through this whole range).
 */
const services = [
  {
    title: 'Sistemas\nsob medida',
    body: 'Cadastro, agenda, estoque, financeiro e permissões do jeito que a sua operação funciona. Software que espelha o processo real — não o contrário.',
  },
  {
    title: 'Sites e\ne-commerce',
    body: 'Presença que converte. Sites rápidos, mensuráveis e ligados ao resto do sistema: o lead que chega vira tarefa, cobrança e relatório sem ninguém copiar e colar.',
  },
  {
    title: 'Automações que\nnão dormem',
    body: 'Cobrança, conciliação, follow-up, relatórios. O robô assume o repetitivo e devolve horas pra sua equipe toda semana — sem esquecer, sem errar de linha.',
  },
  {
    title: 'Integrações de\nponta a ponta',
    body: 'ERP, CRM, WhatsApp, planilhas e bancos falando a mesma língua. O dado entra uma vez e aparece em todo lugar — sem redigitação, sem versão desatualizada.',
  },
] as const

export function ServiceBlocks() {
  return (
    <section id="servicos" aria-label="Serviços">
      {services.map((service) => (
        <div key={service.title} className="relative z-10 flex min-h-[85svh] items-center">
          <div className="shell flex justify-end">
            <div className="max-w-md">
              <LineReveal
                text={service.title}
                className="text-[clamp(2.2rem,4.6vw,3.6rem)] leading-[1.04]"
              />
              <Reveal delay={0.15}>
                <p className="mt-6 text-[clamp(1rem,1.3vw,1.15rem)] leading-[1.6] text-ash">
                  {service.body}
                </p>
              </Reveal>
            </div>
          </div>
        </div>
      ))}
    </section>
  )
}
