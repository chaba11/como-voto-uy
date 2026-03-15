import { urlImpoLey, ETIQUETAS_TIPO_ASUNTO } from '@como-voto-uy/shared'

function IconoEnlace() {
  return (
    <svg className="inline-block h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3.5 1.5H1.5v9h9v-2" />
      <path d="M7 1.5h3.5V5M7 5.5l4-4" />
    </svg>
  )
}

export function EnlacesExternos({
  carpeta,
  numeroLey,
  tipoAsunto,
}: {
  carpeta: string | null
  numeroLey: string | null
  tipoAsunto: string | null
}) {
  const etiqueta = tipoAsunto ? ETIQUETAS_TIPO_ASUNTO[tipoAsunto] : null
  const hayEnlaces = numeroLey

  if (!etiqueta && !hayEnlaces) return null

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {etiqueta && (
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-[#002868]">
          {etiqueta}
        </span>
      )}
      {numeroLey && (
        <a
          href={urlImpoLey(numeroLey)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 transition-colors hover:bg-slate-200"
        >
          Texto de la ley (IMPO) <IconoEnlace />
        </a>
      )}
    </div>
  )
}
