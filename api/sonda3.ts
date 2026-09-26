/* SONDA TEMPORÁRIA: TypeScript importando um .ts de FORA de api/. */
import { simplificar } from '../lib/bot/util.ts'
export default function handler(_req: unknown, res: { status(n: number): { json(x: unknown): void } }) {
  res.status(200).json({ sonda: 3, ok: true, prova: simplificar('Ação') })
}
