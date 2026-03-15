import Link from 'next/link'
import { ETIQUETAS_TIPO_ASUNTO } from '@como-voto-uy/shared'

interface DatosAsunto {
  id: number
  tituloPublico: string
  origenTitulo?: string
  calidadTitulo?: string
  fecha: string
  cuerpo: string
  resultado?: 'afirmativa' | 'negativa' | null
  afirmativos?: number | null
  negativos?: number | null
  unanimidad?: boolean | null
  estadoCobertura?: string
  modalidad?: string
  tipoAsunto?: string | null
  numeroLey?: string | null
}

export function TarjetaAsunto({ asunto }: { asunto: DatosAsunto }) {
  return (
    <Link
      href={`/ley/${asunto.id}`}
      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 font-semibold text-gray-900">{asunto.tituloPublico}</h3>
        {asunto.resultado && (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
              asunto.unanimidad
                ? 'bg-blue-50 text-blue-700'
                : asunto.resultado === 'afirmativa'
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-700'
            }`}
          >
            {asunto.unanimidad ? 'Unanimidad' : asunto.resultado === 'afirmativa' ? 'Aprobada' : 'Rechazada'}
          </span>
        )}
      </div>

      {(asunto.origenTitulo === 'identificador' || asunto.calidadTitulo === 'incompleto') && (
        <p className="mt-1 text-xs text-amber-700">Título incompleto</p>
      )}

      <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
        <span>{asunto.fecha}</span>
        <span className="capitalize">{asunto.cuerpo}</span>
        {asunto.afirmativos != null && asunto.negativos != null && (
          <span className="flex items-center gap-2">
            <span className="text-green-600">✓ {asunto.afirmativos}</span>
            <span className="text-red-600">✗ {asunto.negativos}</span>
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {asunto.estadoCobertura && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
            {asunto.estadoCobertura}
          </span>
        )}
        {asunto.modalidad && (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-[#002868]">
            {asunto.modalidad}
          </span>
        )}
        {asunto.tipoAsunto && ETIQUETAS_TIPO_ASUNTO[asunto.tipoAsunto] && (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-[#002868]">
            {ETIQUETAS_TIPO_ASUNTO[asunto.tipoAsunto]}
          </span>
        )}
        {asunto.numeroLey && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
            Ley N° {asunto.numeroLey}
          </span>
        )}
      </div>
    </Link>
  )
}
