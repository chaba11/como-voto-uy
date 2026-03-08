import Link from 'next/link'
import { obtenerRankingParticipacion } from '@/lib/estadisticas'
import { obtenerPartidos } from '@/lib/consultas'
import { GraficoAlineamiento } from '@/components/grafico-alineamiento'
import { calcularAlineamiento } from '@/lib/estadisticas'

export default async function PaginaRanking({
  searchParams,
}: {
  searchParams: Promise<{ camara?: string; partido?: string; departamento?: string }>
}) {
  const params = await searchParams
  const camara = params.camara || undefined
  const partidoId = params.partido ? parseInt(params.partido, 10) : undefined
  const departamento = params.departamento || undefined

  let ranking: Awaited<ReturnType<typeof obtenerRankingParticipacion>> = []
  let partidosList: Awaited<ReturnType<typeof obtenerPartidos>> = []

  try {
    ;[ranking, partidosList] = await Promise.all([
      obtenerRankingParticipacion({
        camara,
        partidoId: partidoId && !isNaN(partidoId) ? partidoId : undefined,
        departamento,
      }),
      obtenerPartidos(),
    ])
  } catch {
    // DB not available
  }

  // Get unique departamentos from ranking data
  const departamentos = [...new Set(ranking.map((r) => r.departamento).filter(Boolean))] as string[]
  departamentos.sort()

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-8 text-3xl font-bold text-gray-900">
        Ranking de participacion
      </h1>

      {/* Filtros */}
      <div className="mb-6 rounded-xl bg-white p-4 shadow-sm">
        <form className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Camara
            </label>
            <select
              name="camara"
              defaultValue={camara || ''}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Todas</option>
              <option value="senado">Senado</option>
              <option value="representantes">Representantes</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Partido
            </label>
            <select
              name="partido"
              defaultValue={params.partido || ''}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              {partidosList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Departamento
            </label>
            <select
              name="departamento"
              defaultValue={departamento || ''}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              {departamentos.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-[#002868] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#001a4a]"
          >
            Filtrar
          </button>
        </form>
      </div>

      {/* Tabla */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        {ranking.length === 0 ? (
          <p className="py-8 text-center text-gray-500">
            No hay datos disponibles.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-gray-500">
                  <th className="pb-2 pr-4">#</th>
                  <th className="pb-2 pr-4">Nombre</th>
                  <th className="pb-2 pr-4">Partido</th>
                  <th className="pb-2 pr-4">Camara</th>
                  <th className="pb-2 pr-4">Departamento</th>
                  <th className="pb-2 pr-4 text-right">Participacion</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((leg) => (
                  <tr key={leg.legisladorId} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-medium text-gray-400">
                      {leg.rank}
                    </td>
                    <td className="py-3 pr-4">
                      <Link
                        href={`/legislador/${leg.legisladorId}`}
                        className="font-medium text-[#002868] hover:underline"
                      >
                        {leg.nombre}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                        style={{ backgroundColor: leg.partidoColor || '#6b7280' }}
                      >
                        {leg.partidoSigla}
                      </span>
                    </td>
                    <td className="py-3 pr-4 capitalize text-gray-600">
                      {leg.camara === 'senado' ? 'Senado' : 'Representantes'}
                    </td>
                    <td className="py-3 pr-4 text-gray-600">
                      {leg.departamento || '-'}
                    </td>
                    <td className="py-3 text-right">
                      <span
                        className={`font-semibold ${
                          leg.participacion > 80
                            ? 'text-green-600'
                            : leg.participacion >= 50
                              ? 'text-yellow-600'
                              : 'text-red-600'
                        }`}
                      >
                        {leg.participacion}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
