/** Single source of truth for contact details and nav targets. Swap these for the real ones. */
export const site = {
  name: 'Astro',
  email: 'contato@astro.dev.br',
  whatsapp: {
    label: '+55 (11) 90000-0000',
    href: 'https://wa.me/5511900000000?text=Quero%20agendar%20um%20diagn%C3%B3stico%20com%20a%20Astro',
  },
  linkedin: 'https://linkedin.com/company/astro',
  github: 'https://github.com/astro',
  city: 'São Paulo, Brasil',
} as const

export const navLinks = [
  { label: 'Serviços', href: '#servicos' },
  { label: 'Processo', href: '#processo' },
  { label: 'Stack', href: '#stack' },
  { label: 'Resultados', href: '#resultados' },
  { label: 'Dúvidas', href: '#duvidas' },
] as const
