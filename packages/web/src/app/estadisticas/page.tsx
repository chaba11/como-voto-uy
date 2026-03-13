import Link from 'next/link'
import {
  calcularAfinidadPartidos,
  obtenerEstadisticasGlobales,
  obtenerLeyesDivididas,
} from '@/lib/estadisticas'

export default async function PaginaEstadisticas() {
  const [globales, leyesDivididas, afinidad] = await Promise.all([
    obtenerEstadisticasGlobales(),
    obtenerLeyesDivididas(15),
    calcularAfinidadPartidos(),
  ])

  const partidosSiglas = [...new Set(afinidad.flatMap((fila) => [fila.partido1, fila.partido2]))]
  const afinidadMap: Record<string, Record<string, number>> = {}
  for (const fila of afinidad) {
    if (!afinidadMap[fila.partido1]) afinidadMap[fila.partido1] = {}
    if (!afinidadMap[fila.partido2]) afinidadMap[fila.partido2] = {}
    afinidadMap[fila.partido1][fila.partido2] = fila.porcentaje
    afinidadMap[fila.partido2][fila.partido1] = fila.porcentaje
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-8 text-3xl font-bold text-gray-900">Estadísticas</h1>

      <div className="mb-8 grid gap-4 sm:grid-cols-4">
        <div className="rounded-lg bg-white p-6 text-center shadow-sm">
          <div className="text-3xl font-bold text-[#002868]">{globales.totalLegisladores}</div>
          <div className="mt-1 text-sm text-gray-500">Legisladores</div>
        </div>
        <div className="rounded-lg bg-white p-6 text-center shadow-sm">
          <div className="text-3xl font-bold text-[#002868]">{globales.totalAsuntos}</div>
          <div className="mt-1 text-sm text-gray-500">Asuntos</div>
        </div>
        <div className="rounded-lg bg-white p-6 text-center shadow-sm">
          <div className="text-3xl font-bold text-[#002868]">{globales.totalVotosIndividuales}</div>
          <div className="mt-1 text-sm text-gray-500">Votos individuales</div>
        </div>
        <div className="rounded-lg bg-white p-6 text-center shadow-sm">
          <div className="text-3xl font-bold text-[#002868]">{globales.totalSesiones}</div>
          <div className="mt-1 text-sm text-gray-500">Sesiones</div>
        </div>
      </div>

      <div className="mb-8 rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-bold text-gray-900">Asuntos más divididos</h2>
        {leyesDivididas.length === 0 ? (
          <p className="py-8 text-center text-gray-500">No hay datos suficientes.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-gray-500">
                  <th className="pb-2 pr-4">Asunto</th>
                  <th className="pb-2 pr-4">Fecha</th>
                  <th className="pb-2 pr-4">Cuerpo</th>
                  <th className="pb-2 pr-4 text-right">Afirmativos</th>
                  <th className="pb-2 text-right">Negativos</th>
                </tr>
              </thead>
              <tbody>
                {leyesDivididas.map((ley) => (
                  <tr key={`${ley.asuntoId}-${ley.fecha}`} className="border-b last:border-0">
                    <td className="py-3 pr-4">
                      <Link href={`/ley/${ley.asuntoId}`} className="font-medium text-[#002868] hover:underline">
                        {ley.tituloPublico}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-gray-500">{ley.fecha}</td>
                    <td className="py-3 pr-4 capitalize text-gray-500">{ley.cuerpo}</td>
                    <td className="py-3 pr-4 text-right font-medium text-green-600">{ley.afirmativos ?? '-'}</td>
                    <td className="py-3 text-right font-medium text-red-600">{ley.negativos ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {partidosSiglas.length > 0 && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-bold text-gray-900">Afinidad interpartidaria</h2>
          <div className="overflow-x-auto">
            <table className="text-sm">
              <thead>
                <tr>
                  <th className="p-2" />
                  {partidosSiglas.map((sigla) => (
                    <th key={sigla} className="p-2 text-center text-xs font-medium text-gray-700">
                      {sigla}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {partidosSiglas.map((fila) => (
                  <tr key={fila}>
                    <td className="p-2 text-xs font-medium text-gray-700">{fila}</td>
                    {partidosSiglas.map((columna) => (
                      <td key={columna} className="p-2 text-center text-xs text-gray-700">
                        {fila === columna ? '-' : `${afinidadMap[fila]?.[columna] ?? 0}%`}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}