import { useCallback, useEffect, useState } from 'react'
import { apagar, enviar, pedir, type Clinica } from '../api'
import { Aviso, Botao } from '../ui'

type Instancia = { estado: 'desconectado' | 'aguardando_qr' | 'conectado'; qr: string | null; numero: string | null; instancia: string | null }

/**
 * Conexão do WhatsApp por QR code (Evolution API). O QR vence em menos de
 * um minuto; enquanto a clínica não escaneia, a tela pede um novo a cada
 * 20 segundos e mostra o estado ao vivo.
 */
export function ConexaoWhatsapp({ clinica, aoMudar }: { clinica: Clinica; aoMudar: () => Promise<void> | void }) {
  const [inst, setInst] = useState<Instancia | null>(null)
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const ler = useCallback(async () => {
    try {
      const r = await pedir<Instancia>('instancia')
      setInst(r)
      setErro('')
      return r
    } catch (f) {
      setErro(f instanceof Error ? f.message : 'falhou')
      return null
    }
  }, [])

  useEffect(() => {
    void ler()
  }, [ler])

  useEffect(() => {
    if (inst?.estado !== 'aguardando_qr') return
    const relogio = window.setInterval(() => {
      void ler().then((r) => {
        if (r?.estado === 'conectado') void aoMudar()
      })
    }, 20000)
    return () => window.clearInterval(relogio)
  }, [inst?.estado, ler, aoMudar])

  async function conectar() {
    setOcupado(true)
    try {
      setInst(await enviar<Instancia>('instancia', {}))
      setErro('')
    } catch (f) {
      setErro(f instanceof Error ? f.message : 'falhou')
    } finally {
      setOcupado(false)
    }
  }

  async function desconectar() {
    if (!window.confirm('Desconectar o WhatsApp da clínica? O assistente para de responder até conectar de novo.')) return
    setOcupado(true)
    try {
      await apagar('instancia')
      await ler()
      await aoMudar()
    } catch (f) {
      setErro(f instanceof Error ? f.message : 'falhou')
    } finally {
      setOcupado(false)
    }
  }

  const estado = inst?.estado || clinica.whatsapp_status
  return (
    <div className="graphite-card flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="label-voice text-[10px]">WhatsApp da clínica</p>
          <p className={`mt-2 text-[16px] ${estado === 'conectado' ? 'text-[#86e8a8]' : estado === 'aguardando_qr' ? 'text-[#ffd479]' : 'text-slate'}`}>
            {estado === 'conectado' ? `● Conectado${inst?.numero || clinica.whatsapp_numero ? ` · ${inst?.numero || clinica.whatsapp_numero}` : ''}` : estado === 'aguardando_qr' ? '○ Aguardando o QR code' : '○ Desconectado'}
          </p>
        </div>
        <div className="flex gap-2">
          {estado === 'conectado' ? (
            <Botao tipo="perigo" disabled={ocupado} onClick={() => void desconectar()}>
              Desconectar
            </Botao>
          ) : (
            <Botao disabled={ocupado} onClick={() => void conectar()}>
              {ocupado ? 'Aguarde…' : estado === 'aguardando_qr' ? 'Novo QR code' : 'Conectar'}
            </Botao>
          )}
        </div>
      </div>
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {inst?.qr && estado !== 'conectado' ? (
        <div className="flex flex-col items-center gap-3">
          <img src={`data:image/png;base64,${inst.qr}`} alt="QR code para conectar o WhatsApp" className="h-64 w-64 rounded-xl bg-white p-2" />
          <p className="max-w-sm text-center text-[12px] leading-[1.5] text-slate">
            No celular da clínica: WhatsApp → Configurações → Aparelhos conectados → Conectar aparelho, e aponte a câmera. O código se renova sozinho a cada 20 segundos.
          </p>
        </div>
      ) : null}
      <p className="text-[12px] leading-[1.5] text-slate">
        Use um número só da clínica. Ele continua funcionando no celular como sempre; o assistente responde pelo mesmo número. Se a Meta pedir verificação, é normal na primeira conexão.
      </p>
    </div>
  )
}
