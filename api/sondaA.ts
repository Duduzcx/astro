/* SONDA TEMPORÁRIA: TypeScript importando um .ts de DENTRO de api/. */
import { prova } from './_sonda/coisa.ts'
export default function handler(_req: unknown, res: { status(n: number): { json(x: unknown): void } }) {
  res.status(200).json({ sonda: 'A', ok: true, prova })
}
