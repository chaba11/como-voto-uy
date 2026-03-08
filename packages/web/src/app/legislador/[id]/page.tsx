import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  obtenerLegislador,
  obtenerVotosPorLegislador,
  obtenerEstadisticasLegislador,
} from '@/lib/consultas'
import { TablaVotos } from '@/components/tabla-votos'
import type { TipoVoto } from '@como-voto-uy/shared'

export default async function PaginaLegislador({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const legisladorId = parseInt(id, 10)
  if (isNaN(legisladorId)) notFound()

  let legislador: Awaited<ReturnType<typeof obtenerLegislador>> = null
  let votosLeg: Awaited<ReturnType<typeof obtenerVotosPorLegislador>> = []
  let stats: Awaited<ReturnType<typeof obtenerEstadisticasLegislador>> = null

  try {
    ;[legislador, votosLeg, stats] = await Promise.all([
      obtenerLegislador(legisladorId),
      obtenerVotosPorLegislador(legisladorId),
      obtenerEstadisticasLegislador(legisladorId),
    ])
  } catch {
    // DB not available
  }

  if (!legislador) notFound()

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {/* Header */}
      <div className="mb-8 rounded-xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {legislador.nombre}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-600">
              <span className="capitalize">
                {legislador.camara === 'senado'
                  ? 'Senador/a'
                  : 'Representante'}
              </span>
              {legislador.departamento && (
                <>
                  <span className="text-gray-300">|</span>
                  <span>{legislador.departamento}</span>
                </>
              )}
            </div>
            {legislador.titular && (
              <p className="mt-2 text-sm text-gray-500">
                Suplente de{' '}
                <Link
                  href={`/legislador/${legislador.titular.id}`}
                  className="text-[#002868] hover:underline"
                >
                  {legislador.titular.nombre}
                </Link>
              </p>
            )}
          </div>
          <span
            className="rounded-full px-4 py-1.5 text-sm font-semibold text-white"
            style={{
              backgroundColor: legislador.partido.color || '#6b7280',
            }}
          >
            {legislador.partido.nombre}
          </span>
        </div>
      </div>

      {/* Estadisticas */}
      {stats && stats.totalVotos > 0 && (
        <div className="mb-8 grid gap-4 sm:grid-cols-4">
          <div className="rounded-lg bg-white p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-gray-900">
              {stats.totalVotos}
            </div>
            <div className="text-xs text-gray-500">Votos totales</div>
          </div>
          <div className="rounded-lg bg-white p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-green-600">
              {stats.totalVotos > 0
                ? Math.round((stats.afirmativos / stats.totalVotos) * 100)
                : 0}
              %
            </div>
            <div className="text-xs text-gray-500">Afirmativo</div>
          </div>
          <div className="rounded-lg bg-white p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-red-600">
              {stats.totalVotos > 0
                ? Math.round((stats.negativos / stats.totalVotos) * 100)
                : 0}
              %
            </div>
            <div className="text-xs text-gray-500">Negativo</div>
          </div>
          <div className="rounded-lg bg-white p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-[#002868]">
              {stats.porcentajeAsistencia}%
            </div>
            <div className="text-xs text-gray-500">Asistencia</div>
          </div>
        </div>
      )}

      {/* Historial de votos */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-bold text-gray-900">
          Historial de votos
        </h2>
        <TablaVotos
          votos={votosLeg.map((v) => ({
            id: v.id,
            voto: v.voto as TipoVoto,
            proyectoLeyId: v.proyectoLeyId,
            proyectoNombre: v.proyectoNombre,
            fecha: v.fecha,
            camara: v.camara,
          }))}
        />
      </div>
    </div>
  )
}
