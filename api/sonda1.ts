/* SONDA TEMPORÁRIA: uma função TypeScript sem import nenhum. */
export default function handler(_req: unknown, res: { status(n: number): { json(x: unknown): void } }) {
  res.status(200).json({ sonda: 1, ok: true })
}
