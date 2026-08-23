/**
 * Single source of truth for company details and nav targets.
 * Everything here is placeholder data — swap for the real values before launch.
 */
export const site = {
  name: 'Astro Bot',
  legalName: 'Astro Bot Tecnologia LTDA',
  cnpj: '00.000.000/0001-00',
  email: 'contato@astrobot.dev.br',
  phone: {
    label: '+55 (11) 90000-0000',
    href: 'tel:+5511900000000',
  },
  whatsapp: {
    label: '+55 (11) 90000-0000',
    href: 'https://wa.me/5511900000000?text=Quero%20agendar%20um%20diagn%C3%B3stico%20com%20a%20Astro%20Bot',
  },
  linkedin: 'https://linkedin.com/company/astrobot',
  instagram: 'https://instagram.com/astrobot.tech',
  github: 'https://github.com/astrobot',
  address: 'Av. Paulista, 1000 · Sala 71 · Bela Vista, São Paulo/SP',
  hours: 'Segunda a sexta, das 9h às 18h',
  city: 'São Paulo, Brasil',
} as const

/** Four items, no more. The nav is a legend for the page, not a table of contents. */
export const navLinks = [
  { label: 'Serviços', href: '#servicos' },
  { label: 'Processo', href: '#processo' },
  { label: 'Clientes', href: '#clientes' },
  { label: 'Contato', href: '#contato' },
] as const

/** The footer can afford the full map. */
export const footerLinks = [
  { label: 'Serviços', href: '#servicos' },
  { label: 'Manifesto', href: '#manifesto' },
  { label: 'Sobre nós', href: '#sobre' },
  { label: 'Processo', href: '#processo' },
  { label: 'Resultados', href: '#resultados' },
  { label: 'Equipe', href: '#equipe' },
  { label: 'Tech insights', href: '#insights' },
  { label: 'Perguntas frequentes', href: '#faq' },
] as const
