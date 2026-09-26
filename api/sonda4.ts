/* SONDA TEMPORÁRIA: TypeScript importando um .ts de fora SEM a extensão. */
import { somenteDigitos } from '../lib/bot/util'
export default function handler(_req: unknown, res: { status(n: number): { json(x: unknown): void } }) {
  res.status(200).json({ sonda: 4, ok: true, prova: somenteDigitos('a1b2') })
}
