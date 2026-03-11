import Link from 'next/link'
import { obtenerPartidos } from '@/lib/consultas'
import { obtenerRankingParticipacion } from '@/lib/estadisticas'

export default async function PaginaRanking({
  searchParams,
}: {
  searchParams: Promise<{ camara?: string; partido?: string; departamento?: string }>
}) {
  const params = await searchParams
  const camara = params.camara || undefined
  const partidoId = params.partido ? parseInt(params.partido, 10) : undefined
  const departamento = params.departamento || undefined

  const [ranking, partidos] = await Promise.all([
    obtenerRankingParticipacion({
      camara,
      partidoId: partidoId && !Number.isNaN(partidoId) ? partidoId : undefined,
      departamento,
    }),
    obtenerPartidos(),
  ])

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-8 text-3xl font-bold text-gray-900">Ranking de participación</h1>

      <div className="mb-6 rounded-xl bg-white p-4 shadow-sm">
        <form className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Cámara</label>
            <select name="camara" defaultValue={camara || ''} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">Todas</option>
              <option value="senado">Senado</option>
              <option value="representantes">Representantes</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Partido</label>
            <select name="partido" defaultValue={params.partido || ''} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">Todos</option>
              {partidos.map((partido) => (
                <option key={partido.id} value={partido.id}>{partido.nombre}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="rounded-lg bg-[#002868] px-4 py-2 text-sm font-medium text-white hover:bg-[#001a4a]">
            Filtrar
          </button>
        </form>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        {ranking.length === 0 ? (
          <p className="py-8 text-center text-gray-500">No hay datos disponibles.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-gray-500">
                  <th className="pb-2 pr-4">#</th>
                  <th className="pb-2 pr-4">Nombre</th>
                  <th className="pb-2 pr-4">Partido</th>
                  <th className="pb-2 pr-4">Cámara</th>
                  <th className="pb-2 text-right">Participación</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((fila) => (
                  <tr key={fila.legisladorId} className="border-b last:border-0">
                    <td className="py-3 pr-4 text-gray-400">{fila.rank}</td>
                    <td className="py-3 pr-4">
                      <Link href={`/legislador/${fila.legisladorId}`} className="font-medium text-[#002868] hover:underline">
                        {fila.nombre}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className="rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                        style={{ backgroundColor: fila.partidoColor || '#6b7280' }}
                      >
                        {fila.partidoSigla}
                      </span>
                    </td>
                    <td className="py-3 pr-4 capitalize text-gray-600">{fila.camara}</td>
                    <td className="py-3 text-right font-semibold text-[#002868]">{fila.participacion}%</td>
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
