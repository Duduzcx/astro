/* SONDA TEMPORÁRIA: TypeScript importando um .js de dentro de api/. */
import { qualInteligencia } from './_lib/inteligencia.js'
export default function handler(_req: unknown, res: { status(n: number): { json(x: unknown): void } }) {
  res.status(200).json({ sonda: 2, ok: true, ia: qualInteligencia() })
}
