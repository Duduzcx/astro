/**
 * Configuração que a equipe edita pelo painel, sem republicar o site.
 *
 * Hoje guarda os textos do robô do WhatsApp. O padrão mora no código: se o
 * banco não estiver ligado, ou se a chave nunca tiver sido salva, o robô
 * responde igual — configuração ausente nunca pode deixar alguém sem
 * resposta do outro lado.
 */
import { prepararBanco, sql, temBanco } from './db.js'

export async function lerConfig(chave, padrao) {
  if (!temBanco()) return padrao
  try {
    await prepararBanco()
    const s = sql()
    const [linha] = await s`SELECT valor FROM config WHERE chave = ${chave}`
    return linha?.valor ?? padrao
  } catch (erro) {
    console.error('leitura de config falhou:', erro?.message)
    return padrao
  }
}

/**
 * A chave geral do atendimento automático, ligada e desligada pelo painel.
 * Desligada, o robô do WhatsApp fica em silêncio (a mensagem é registrada e
 * o lead entra, mas quem responde é uma pessoa) e o chat do site volta ao
 * roteiro. Sem banco não há como desligar: fica ligado.
 */
export async function botAtivo() {
  const valor = await lerConfig('bot_ativo', true)
  return valor !== false
}

export async function gravarConfig(chave, valor) {
  await prepararBanco()
  const s = sql()
  await s`
    INSERT INTO config ${s({ chave, valor: JSON.stringify(valor) })}
    ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, atualizado_em = now()`
  return true
}
