'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function Buscador({
  valorInicial = '',
  className = '',
}: {
  valorInicial?: string
  className?: string
}) {
  const router = useRouter()
  const [termino, setTermino] = useState(valorInicial)

  function manejarSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (termino.trim()) {
      router.push(`/buscar?q=${encodeURIComponent(termino.trim())}`)
    }
  }

  return (
    <form onSubmit={manejarSubmit} className={`flex gap-2 ${className}`}>
      <input
        type="text"
        value={termino}
        onChange={(e) => setTermino(e.target.value)}
        placeholder="Buscar legisladores o leyes..."
        className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 shadow-sm focus:border-[#002868] focus:ring-2 focus:ring-[#002868]/20 focus:outline-none"
      />
      <button
        type="submit"
        className="rounded-lg bg-[#002868] px-6 py-3 font-medium text-white shadow-sm transition-colors hover:bg-[#001a4a]"
      >
        Buscar
      </button>
    </form>
  )
}
