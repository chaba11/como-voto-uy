import Link from 'next/link'

interface PropsPaginacion {
  paginaActual: number
  totalPaginas: number
  searchParams: Record<string, string | undefined>
  paramPagina?: string
}

export function Paginacion({ paginaActual, totalPaginas, searchParams, paramPagina = 'pagina' }: PropsPaginacion) {
  if (totalPaginas <= 1) return null

  function construirUrl(pagina: number) {
    const params = new URLSearchParams()
    for (const [clave, valor] of Object.entries(searchParams)) {
      if (valor !== undefined && clave !== paramPagina) {
        params.set(clave, valor)
      }
    }
    if (pagina > 1) params.set(paramPagina, String(pagina))
    const qs = params.toString()
    return qs ? `?${qs}` : '?'
  }

  const paginas: (number | '...')[] = []
  if (totalPaginas <= 7) {
    for (let i = 1; i <= totalPaginas; i++) paginas.push(i)
  } else {
    paginas.push(1)
    if (paginaActual > 3) paginas.push('...')
    for (let i = Math.max(2, paginaActual - 1); i <= Math.min(totalPaginas - 1, paginaActual + 1); i++) {
      paginas.push(i)
    }
    if (paginaActual < totalPaginas - 2) paginas.push('...')
    paginas.push(totalPaginas)
  }

  const estiloBase = 'rounded-lg px-3 py-1.5 text-sm'
  const estiloActivo = 'bg-[#002868] text-white font-medium'
  const estiloInactivo = 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
  const estiloDeshabilitado = 'text-gray-300 cursor-default'

  return (
    <nav className="flex items-center justify-center gap-1 pt-6" aria-label="Paginación">
      {paginaActual > 1 ? (
        <Link href={construirUrl(paginaActual - 1)} className={`${estiloBase} ${estiloInactivo}`}>
          ← Anterior
        </Link>
      ) : (
        <span className={`${estiloBase} ${estiloDeshabilitado}`}>← Anterior</span>
      )}

      {paginas.map((pagina, i) =>
        pagina === '...' ? (
          <span key={`dots-${i}`} className="px-2 text-gray-400">…</span>
        ) : (
          <Link
            key={pagina}
            href={construirUrl(pagina)}
            className={`${estiloBase} ${pagina === paginaActual ? estiloActivo : estiloInactivo}`}
          >
            {pagina}
          </Link>
        ),
      )}

      {paginaActual < totalPaginas ? (
        <Link href={construirUrl(paginaActual + 1)} className={`${estiloBase} ${estiloInactivo}`}>
          Siguiente →
        </Link>
      ) : (
        <span className={`${estiloBase} ${estiloDeshabilitado}`}>Siguiente →</span>
      )}
    </nav>
  )
}
