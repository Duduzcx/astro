/**
 * O diário do robô: cada mensagem que entrou (WhatsApp ou chat do site) e o
 * que saiu, com o modo que decidiu a resposta. É o que o painel mostra como
 * interações em tempo real.
 *
 * Sem banco não há diário, e nada quebra: registrar é sempre "tenta e
 * segue". O robô nunca deixa de responder porque o registro falhou — a
 * pessoa do outro lado está esperando, e o diário é para a equipe.
 */
import { prepararBanco, sql, temBanco } from './db.js'
import { texto } from './leads.js'

const GUARDAR = 2000

export async function registrarLog({ canal = '', de = '', entrada = '', saida = '', modo = '' } = {}) {
  if (!temBanco()) return false
  try {
    await prepararBanco()
    const s = sql()
    await s`
      INSERT INTO bot_logs ${s({
        canal: texto(canal, 20),
        de: texto(de, 60),
        entrada: texto(entrada, 1500),
        saida: texto(saida, 3000),
        modo: texto(modo, 20),
      })}`
    /* Poda, de vez em quando: ficam as últimas duas mil linhas. Fazer isto em
       toda gravação seria uma consulta a mais por mensagem, por nada. */
    if (Math.random() < 0.02) {
      await s`
        DELETE FROM bot_logs
        WHERE id < (SELECT id FROM bot_logs ORDER BY id DESC OFFSET ${GUARDAR} LIMIT 1)`
    }
    return true
  } catch (erro) {
    console.error('registro do robô falhou:', erro?.message)
    return false
  }
}

export async function listarLogs(limite = 100) {
  if (!temBanco()) return []
  await prepararBanco()
  const s = sql()
  return s`SELECT * FROM bot_logs ORDER BY id DESC LIMIT ${Math.min(Number(limite) || 100, 500)}`
}
