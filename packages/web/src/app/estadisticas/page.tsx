import Link from 'next/link'
import {
  obtenerEstadisticasGlobales,
  obtenerLeyesDivididas,
  calcularAfinidadPartidos,
} from '@/lib/estadisticas'

export default async function PaginaEstadisticas() {
  let globales = { totalLegisladores: 0, totalProyectos: 0, totalVotos: 0, totalSesiones: 0 }
  let leyesDivididas: Awaited<ReturnType<typeof obtenerLeyesDivididas>> = []
  let afinidad: Awaited<ReturnType<typeof calcularAfinidadPartidos>> = []

  try {
    ;[globales, leyesDivididas, afinidad] = await Promise.all([
      obtenerEstadisticasGlobales(),
      obtenerLeyesDivididas(15),
      calcularAfinidadPartidos(),
    ])
  } catch {
    // DB not available
  }

  // Build heatmap data structure
  const partidosSiglas = [...new Set(afinidad.flatMap((a) => [a.partido1, a.partido2]))]
  const afinidadMap: Record<string, Record<string, number>> = {}
  for (const a of afinidad) {
    if (!afinidadMap[a.partido1]) afinidadMap[a.partido1] = {}
    if (!afinidadMap[a.partido2]) afinidadMap[a.partido2] = {}
    afinidadMap[a.partido1][a.partido2] = a.porcentaje
    afinidadMap[a.partido2][a.partido1] = a.porcentaje
  }

  function colorAfinidad(valor: number): string {
    if (valor >= 80) return 'bg-green-200 text-green-900'
    if (valor >= 60) return 'bg-yellow-100 text-yellow-900'
    if (valor >= 40) return 'bg-orange-100 text-orange-900'
    return 'bg-red-100 text-red-900'
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-8 text-3xl font-bold text-gray-900">Estadisticas</h1>

      {/* Estadísticas globales */}
      <div className="mb-8 grid gap-4 sm:grid-cols-4">
        <div className="rounded-lg bg-white p-6 text-center shadow-sm">
          <div className="text-3xl font-bold text-[#002868]">
            {globales.totalLegisladores}
          </div>
          <div className="mt-1 text-sm text-gray-500">Legisladores</div>
        </div>
        <div className="rounded-lg bg-white p-6 text-center shadow-sm">
          <div className="text-3xl font-bold text-[#002868]">
            {globales.totalProyectos}
          </div>
          <div className="mt-1 text-sm text-gray-500">Proyectos de ley</div>
        </div>
        <div className="rounded-lg bg-white p-6 text-center shadow-sm">
          <div className="text-3xl font-bold text-[#002868]">
            {globales.totalVotos}
          </div>
          <div className="mt-1 text-sm text-gray-500">Votos registrados</div>
        </div>
        <div className="rounded-lg bg-white p-6 text-center shadow-sm">
          <div className="text-3xl font-bold text-[#002868]">
            {globales.totalSesiones}
          </div>
          <div className="mt-1 text-sm text-gray-500">Sesiones</div>
        </div>
      </div>

      {/* Leyes más divididas */}
      <div className="mb-8 rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-bold text-gray-900">
          Leyes mas divididas
        </h2>
        {leyesDivididas.length === 0 ? (
          <p className="py-8 text-center text-gray-500">
            No hay datos disponibles.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-gray-500">
                  <th className="pb-2 pr-4">Proyecto</th>
                  <th className="pb-2 pr-4">Fecha</th>
                  <th className="pb-2 pr-4">Camara</th>
                  <th className="pb-2 pr-4 text-right">Afirmativos</th>
                  <th className="pb-2 pr-4 text-right">Negativos</th>
                  <th className="pb-2 text-right">Margen</th>
                </tr>
              </thead>
              <tbody>
                {leyesDivididas.map((ley) => (
                  <tr key={ley.proyectoId} className="border-b last:border-0">
                    <td className="py-3 pr-4">
                      <Link
                        href={`/ley/${ley.proyectoId}`}
                        className="font-medium text-[#002868] hover:underline"
                      >
                        {ley.nombre}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-gray-500">{ley.fecha}</td>
                    <td className="py-3 pr-4 capitalize text-gray-500">
                      {ley.camara === 'senado' ? 'Senado' : 'Representantes'}
                    </td>
                    <td className="py-3 pr-4 text-right font-medium text-green-600">
                      {ley.afirmativos}
                    </td>
                    <td className="py-3 pr-4 text-right font-medium text-red-600">
                      {ley.negativos}
                    </td>
                    <td className="py-3 text-right font-semibold text-gray-900">
                      {Math.abs(ley.afirmativos - ley.negativos)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Afinidad inter-partido */}
      {partidosSiglas.length > 0 && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-bold text-gray-900">
            Afinidad inter-partido
          </h2>
          <p className="mb-4 text-sm text-gray-500">
            Porcentaje de veces que la mayoria de cada partido voto en la misma direccion.
          </p>
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
                    <td className="p-2 text-xs font-medium text-gray-700">
                      {fila}
                    </td>
                    {partidosSiglas.map((col) => {
                      const valor = afinidadMap[fila]?.[col] ?? 0
                      const esDiagonal = fila === col
                      return (
                        <td
                          key={col}
                          className={`p-2 text-center text-xs font-medium ${
                            esDiagonal
                              ? 'bg-gray-100 text-gray-400'
                              : colorAfinidad(valor)
                          }`}
                        >
                          {esDiagonal ? '-' : `${valor}%`}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded bg-green-200" /> &gt;80%
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded bg-yellow-100" /> 60-80%
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded bg-orange-100" /> 40-60%
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded bg-red-100" /> &lt;40%
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
