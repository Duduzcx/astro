/**
 * Fonte única dos dados da empresa e dos alvos de navegação.
 * O e-mail ainda é o Gmail provisório, até a caixa no domínio existir.
 */

/** O número no formato do WhatsApp: país, DDD e número, sem sinais. */
export const whatsappNumero = '5511921572675'

/**
 * Monta um link de WhatsApp com a mensagem já escrita.
 *
 * O texto importa: quem chega com a mensagem pronta manda em vez de
 * desistir na tela em branco, e a conversa já começa dizendo de onde a
 * pessoa veio. Um lugar só para montar o link — antes o número aparecia
 * cravado dentro do formulário, e um número em dois lugares é um número
 * que vai divergir.
 */
export function whatsappLink(texto: string) {
  return `https://wa.me/${whatsappNumero}?text=${encodeURIComponent(texto)}`
}

/** A mensagem de quem clicou num botão de WhatsApp, sem passar pelo formulário. */
export const whatsappConvite = [
  'Olá, Astro Soluções! 👋',
  '',
  'Vim pelo site e quero agendar o diagnóstico gratuito.',
  'Pode me contar como funciona?',
].join('\n')

export const site = {
  name: 'Astro Soluções',
  cnpj: '65.903.572/0001-26',
  email: {
    label: 'astrosolucoestech@gmail.com',
    href: 'mailto:astrosolucoestech@gmail.com',
  },
  phone: {
    label: '(11) 92157-2675',
    href: `tel:+${whatsappNumero}`,
  },
  whatsapp: {
    label: '(11) 92157-2675',
    href: whatsappLink(whatsappConvite),
  },
  instagram: {
    label: '@astros.solucoes',
    href: 'https://www.instagram.com/astros.solucoes',
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
