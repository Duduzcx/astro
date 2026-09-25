/* Classes compartilhadas pelas telas do CRM. */

export const campoClasse =
  'mt-1.5 w-full rounded-xl bg-obsidian px-3 py-2 text-[14px] text-ivory outline-none placeholder:text-slate focus:shadow-[inset_0_0_0_1px_#4d84e0]'

export const STATUS_COR: Record<string, string> = {
  agendado: 'text-[#8db4f5] border-[#8db4f5]/35',
  confirmado: 'text-[#86e8a8] border-[#86e8a8]/35',
  cancelado: 'text-slate border-white/15',
  reagendado: 'text-[#c9a6ff] border-[#c9a6ff]/35',
  faltou: 'text-[#ff9b9b] border-[#ff9b9b]/35',
  concluido: 'text-ash border-white/20',
}
