import { notFound } from 'next/navigation'
import { TablaVotos } from '@/components/tabla-votos'
import { obtenerEstadisticasLegislador, obtenerLegislador, obtenerVotosPorLegislador } from '@/lib/consultas'
import type { TipoVoto } from '@como-voto-uy/shared'

export default async function PaginaLegislador({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const legisladorId = parseInt(id, 10)
  if (Number.isNaN(legisladorId)) notFound()

  const [legislador, votos, estadisticas] = await Promise.all([
    obtenerLegislador(legisladorId),
    obtenerVotosPorLegislador(legisladorId),
    obtenerEstadisticasLegislador(legisladorId),
  ])

  if (!legislador) notFound()

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 rounded-xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{legislador.nombre}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-600">
              <span className="capitalize">
                {legislador.camara === 'senado' ? 'Senador/a' : 'Diputado/a'}
              </span>
              <span>Legislatura {legislador.legislaturaId}</span>
              {legislador.departamento && <span>{legislador.departamento}</span>}
            </div>
          </div>
          {legislador.partido.sigla === 'SA' ? (
            <span className="rounded-full bg-amber-50 px-4 py-1.5 text-sm font-semibold text-amber-800">
              Partido pendiente de resolución
            </span>
          ) : (
            <span
              className="rounded-full px-4 py-1.5 text-sm font-semibold text-white"
              style={{ backgroundColor: legislador.partido.color || '#6b7280' }}
            >
              {legislador.partido.sigla}
            </span>
          )}
        </div>
      </div>

      {estadisticas && (
        <div className="mb-8 grid gap-4 sm:grid-cols-5">
          <div className="rounded-lg bg-white p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-gray-900">{estadisticas.totalVotosPublicos}</div>
            <div className="text-xs text-gray-500">Votos públicos</div>
          </div>
          <div className="rounded-lg bg-white p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-green-600">{estadisticas.confirmados}</div>
            <div className="text-xs text-gray-500">Confirmados</div>
          </div>
          <div className="rounded-lg bg-white p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-amber-600">{estadisticas.inferidos}</div>
            <div className="text-xs text-gray-500">Inferidos</div>
          </div>
          <div className="rounded-lg bg-white p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-[#002868]">{estadisticas.porcentajeCobertura}%</div>
            <div className="text-xs text-gray-500">Cobertura</div>
          </div>
          <div className="rounded-lg bg-white p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-[#002868]">{estadisticas.porcentajeAsistencia}%</div>
            <div className="text-xs text-gray-500">Asistencia</div>
          </div>
        </div>
      )}

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-bold text-gray-900">Historial de votos</h2>
        <TablaVotos
          votos={votos.map((voto) => ({
            id: voto.id,
            voto: voto.voto as TipoVoto,
            asuntoId: voto.asuntoId,
            asuntoNombre: voto.asuntoNombre,
            fecha: voto.fecha,
            cuerpo: voto.cuerpo,
            nivelConfianza: voto.nivelConfianza,
          }))}
        />
      </div>
    </div>
  )
}
