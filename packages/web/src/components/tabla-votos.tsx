import Link from 'next/link'
import type { TipoVoto } from '@como-voto-uy/shared'
import { IndicadorVoto } from './indicador-voto'

interface FilaVoto {
  id: number
  voto: TipoVoto
  asuntoId: number | null
  asuntoNombre: string | null
  fecha: string
  cuerpo: string
  nivelConfianza: string
}

export function TablaVotos({ votos }: { votos: FilaVoto[] }) {
  if (votos.length === 0) {
    return (
      <p className="py-8 text-center text-gray-500">
        No se encontraron votos registrados.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-xs font-semibold tracking-wide text-gray-500 uppercase">
            <th className="px-4 py-3">Proyecto de ley</th>
            <th className="px-4 py-3">Fecha</th>
            <th className="px-4 py-3">Cuerpo</th>
            <th className="px-4 py-3">Confianza</th>
            <th className="px-4 py-3">Voto</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {votos.map((v) => (
            <tr key={v.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <Link
                  href={v.asuntoId ? `/ley/${v.asuntoId}` : '#'}
                  className="text-[#002868] hover:underline"
                >
                  {v.asuntoNombre || 'Sin asunto vinculado'}
                </Link>
              </td>
              <td className="px-4 py-3 text-gray-600">{v.fecha}</td>
              <td className="px-4 py-3 capitalize text-gray-600">{v.cuerpo}</td>
              <td className="px-4 py-3">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                  {v.nivelConfianza}
                </span>
              </td>
              <td className="px-4 py-3">
                <IndicadorVoto voto={v.voto as TipoVoto} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
