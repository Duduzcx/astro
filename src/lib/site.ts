/**
 * Fonte única dos dados da empresa e dos alvos de navegação.
 * O e-mail ainda é o Gmail provisório, até a caixa no domínio existir.
 * Redes sociais entram aqui quando os perfis forem criados.
 */
export const site = {
  name: 'Astro Soluções',
  cnpj: '65.903.572/0001-26',
  email: {
    label: 'astrosolucoestech@gmail.com',
    href: 'mailto:astrosolucoestech@gmail.com',
  },
  phone: {
    label: '(11) 92157-2675',
    href: 'tel:+5511921572675',
  },
  whatsapp: {
    label: '(11) 92157-2675',
    href: 'https://wa.me/5511921572675?text=Quero%20agendar%20um%20diagn%C3%B3stico%20com%20a%20Astro%20Solu%C3%A7%C3%B5es',
  },
  hours: 'Atendimento 24h — equipe das 8h às 21h e plantão para urgências no restante',
  city: 'São Paulo, Brasil',
} as const

/** Quatro itens, no máximo. O menu é uma legenda da página, não um índice. */
export const navLinks = [
  { label: 'Serviços', href: '#servicos' },
  { label: 'Projetos', href: '#projetos' },
  { label: 'Processo', href: '#processo' },
  { label: 'Contato', href: '#contato' },
] as const

/** O rodapé pode carregar o mapa completo. */
export const footerLinks = [
  { label: 'Serviços', href: '#servicos' },
  { label: 'Manifesto', href: '#manifesto' },
  { label: 'Projetos', href: '#projetos' },
  { label: 'Sobre nós', href: '#sobre' },
  { label: 'Processo', href: '#processo' },
  { label: 'O que você recebe', href: '#entregaveis' },
  { label: 'Equipe', href: '#equipe' },
  { label: 'Tech insights', href: '#insights' },
  { label: 'Perguntas frequentes', href: '#faq' },
] as const
