'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { X, Download, Printer } from 'lucide-react'

export function QrCodeModal({
  url,
  waiterName,
  companyName,
  onClose,
}: {
  url: string
  waiterName: string
  companyName: string
  onClose: () => void
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    QRCode.toDataURL(url, { width: 512, margin: 2, color: { dark: '#0f0f0f', light: '#ffffff' } }).then(setDataUrl)
  }, [url])

  function handleDownload() {
    if (!dataUrl) return
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `qrcode-${waiterName.toLowerCase().replace(/\s+/g, '-')}.png`
    a.click()
  }

  function handlePrint() {
    if (!dataUrl) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html>
        <head>
          <title>QR Code · ${waiterName}</title>
          <style>
            body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
            .card { text-align: center; border: 2px solid #111; border-radius: 16px; padding: 32px 40px; max-width: 360px; }
            h1 { font-size: 20px; margin: 0 0 4px; }
            p { color: #555; font-size: 13px; margin: 0 0 20px; }
            img { width: 260px; height: 260px; }
            .waiter { font-size: 16px; font-weight: 700; margin-top: 16px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>${companyName}</h1>
            <p>Escaneie para avaliar sua experiência</p>
            <img src="${dataUrl}" />
            <div class="waiter">Atendente: ${waiterName}</div>
          </div>
          <script>window.print()</script>
        </body>
      </html>
    `)
    win.document.close()
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">QR Code · {waiterName}</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="bg-white rounded-lg p-4 flex items-center justify-center mb-4">
          {dataUrl ? <img src={dataUrl} alt="QR Code" className="w-full max-w-56" /> : <div className="h-56 w-56 animate-pulse bg-neutral-200 rounded" />}
        </div>
        <p className="text-xs text-neutral-500 break-all mb-4">{url}</p>
        <div className="flex gap-2">
          <button onClick={handleDownload} className="btn-secondary flex-1 py-2.5 text-sm flex items-center justify-center gap-2">
            <Download size={15} /> Baixar
          </button>
          <button onClick={handlePrint} className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2">
            <Printer size={15} /> Imprimir
          </button>
        </div>
      </div>
    </div>
  )
}
