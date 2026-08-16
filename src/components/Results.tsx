import { Label, Reveal, Section } from './ui/Primitives'

/**
 * Astro is new, so nothing here claims a track record it does not have yet.
 * These are commitments and worked scenarios. Swap them for real client numbers
 * as soon as the first projects ship.
 */
const commitments = [
  { value: '14 dias', label: 'da assinatura à primeira versão no ar' },
  { value: '2 sem.', label: 'entre uma entrega e a próxima, sempre' },
  { value: '24 h', label: 'para responder qualquer chamado de sistema no ar' },
]

const scenarios = [
  {
    sector: 'Distribuidora · pedido no WhatsApp',
    title: 'Pedido vira sistema, não mensagem solta',
    body: 'Vendedor lança pelo celular, o estoque baixa na hora e o financeiro recebe o boleto pronto. Acaba a digitação dupla no fim do dia.',
    metric: 'horas de digitação eliminadas por dia',
  },
  {
    sector: 'Clínica · três unidades',
    title: 'Agenda unificada com confirmação automática',
    body: 'Agendamento online, lembrete por WhatsApp na véspera e painel único das unidades. A recepção para de ligar para confirmar paciente.',
    metric: 'menos falta e menos telefone',
  },
  {
    sector: 'SaaS B2B · primeira versão',
    title: 'Do protótipo ao produto que cobra assinatura',
    body: 'Multi-empresa, planos, cobrança recorrente e painel de uso. O fundador vai ao mercado com produto funcionando, não com slide.',
    metric: 'pronto para o primeiro cliente pagante',
  },
]

export function Results() {
  return (
    <Section id="resultados">
      <Reveal>
        <Label>Compromissos</Label>
        <h2 className="mt-6 max-w-2xl text-[clamp(2rem,5vw,3.25rem)] leading-[0.9] uppercase">
          O que a gente assina embaixo.
        </h2>
      </Reveal>

      <dl className="mt-12 grid gap-10 border-y border-slate/25 py-14 sm:grid-cols-3">
        {commitments.map((item, index) => (
          <Reveal key={item.value} delay={index * 0.08}>
            <dt className="text-[clamp(2.5rem,6vw,4.2rem)] leading-none font-medium tracking-[-0.045em] text-phosphor">
              {item.value}
            </dt>
            <dd className="mt-4 max-w-[16rem] font-mono text-[11px] leading-relaxed tracking-[0.06em] text-mist">
              {item.label}
            </dd>
          </Reveal>
        ))}
      </dl>

      <Reveal className="mt-20">
        <Label>Cenários</Label>
        <p className="mt-5 max-w-xl text-silver">
          Três problemas que aparecem toda semana e o formato de solução que aplicamos em cada
          um.
        </p>
      </Reveal>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {scenarios.map((item, index) => (
          <Reveal
            key={item.title}
            delay={index * 0.08}
            className="flex h-full flex-col rounded-[16px] bg-orbit p-9"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#5aa9ff]">
              {item.sector}
            </p>
            <h3 className="mt-5 text-xl leading-snug">{item.title}</h3>
            <p className="mt-4 text-[15px] text-silver">{item.body}</p>
            <p className="mt-auto pt-8 font-mono text-[11px] tracking-[0.08em] text-mist">
              {item.metric}
            </p>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}
