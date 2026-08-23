/**
 * Single source of truth for company details and nav targets.
 * Real data provided by the founders; e-mail is the provisional Gmail until
 * the domain mailbox exists. No social profiles yet — add them here when live.
 */
export const site = {
  name: 'Astro Soluções',
  cnpj: '65.903.572/0001-26',
  email: 'sq1matheusgsilva@gmail.com',
  phone: {
    label: '(11) 95008-5875',
    href: 'tel:+5511950085875',
  },
  whatsapp: {
    label: '(11) 95008-5875',
    href: 'https://wa.me/5511950085875?text=Quero%20agendar%20um%20diagn%C3%B3stico%20com%20a%20Astro%20Solu%C3%A7%C3%B5es',
  },
  hours: 'Atendimento 24h — equipe das 8h às 21h, assistente de IA no restante',
  city: 'São Paulo, Brasil',
} as const

/** Four items, no more. The nav is a legend for the page, not a table of contents. */
export const navLinks = [
  { label: 'Serviços', href: '#servicos' },
  { label: 'Processo', href: '#processo' },
  { label: 'Entregáveis', href: '#entregaveis' },
  { label: 'Contato', href: '#contato' },
] as const

/** The footer can afford the full map. */
export const footerLinks = [
  { label: 'Serviços', href: '#servicos' },
  { label: 'Manifesto', href: '#manifesto' },
  { label: 'Sobre nós', href: '#sobre' },
  { label: 'Processo', href: '#processo' },
  { label: 'O que você recebe', href: '#entregaveis' },
  { label: 'Equipe', href: '#equipe' },
  { label: 'Tech insights', href: '#insights' },
  { label: 'Perguntas frequentes', href: '#faq' },
] as const
