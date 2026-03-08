import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { obtenerVotosPorProyecto } from '@/lib/consultas'
import { proyectosLey, sesiones } from '@como-voto-uy/shared'
import { eq } from 'drizzle-orm'
import type { TipoVoto } from '@como-voto-uy/shared'
import { DesglosePartido } from '@/components/desglose-partido'
import { IndicadorVoto } from '@/components/indicador-voto'

async function obtenerProyecto(id: number) {
  if (!db) return null
  const resultado = await db
    .select({
      id: proyectosLey.id,
      nombre: proyectosLey.nombre,
      descripcion: proyectosLey.descripcion,
      tema: proyectosLey.tema,
      fecha: sesiones.fecha,
      camara: sesiones.camara,
    })
    .from(proyectosLey)
    .innerJoin(sesiones, eq(proyectosLey.sesionId, sesiones.id))
    .where(eq(proyectosLey.id, id))
    .limit(1)
  return resultado[0] || null
}

export default async function PaginaLey({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const proyectoId = parseInt(id, 10)
  if (isNaN(proyectoId)) notFound()

  let proyecto: Awaited<ReturnType<typeof obtenerProyecto>> = null
  let votosProyecto: Awaited<ReturnType<typeof obtenerVotosPorProyecto>> = []

  try {
    ;[proyecto, votosProyecto] = await Promise.all([
      obtenerProyecto(proyectoId),
      obtenerVotosPorProyecto(proyectoId),
    ])
  } catch {
    // DB not available
  }

  if (!proyecto) notFound()

  const totales = votosProyecto.reduce(
    (acc, v) => {
      acc[v.voto as TipoVoto]++
      return acc
    },
    { afirmativo: 0, negativo: 0, ausente: 0 } as Record<TipoVoto, number>,
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {/* Header */}
      <div className="mb-8 rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-gray-900">{proyecto.nombre}</h1>
        {proyecto.descripcion && (
          <p className="mt-2 text-gray-600">{proyecto.descripcion}</p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-gray-500">
          <span>{proyecto.fecha}</span>
          <span className="text-gray-300">|</span>
          <span className="capitalize">{proyecto.camara}</span>
          {proyecto.tema && (
            <>
              <span className="text-gray-300">|</span>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-[#002868]">
                {proyecto.tema}
              </span>
            </>
          )}
        </div>

        {/* Resumen de votos */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-green-50 p-3 text-center">
            <div className="text-2xl font-bold text-green-700">
              {totales.afirmativo}
            </div>
            <div className="text-xs text-green-600">Afirmativos</div>
          </div>
          <div className="rounded-lg bg-red-50 p-3 text-center">
            <div className="text-2xl font-bold text-red-700">
              {totales.negativo}
            </div>
            <div className="text-xs text-red-600">Negativos</div>
          </div>
          <div className="rounded-lg bg-gray-100 p-3 text-center">
            <div className="text-2xl font-bold text-gray-600">
              {totales.ausente}
            </div>
            <div className="text-xs text-gray-500">Ausentes</div>
          </div>
        </div>
      </div>

      {/* Desglose por partido */}
      <div className="mb-8 rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-bold text-gray-900">
          Votacion por partido
        </h2>
        <DesglosePartido
          votos={votosProyecto.map((v) => ({
            partidoNombre: v.partidoNombre,
            partidoSigla: v.partidoSigla,
            partidoColor: v.partidoColor,
            voto: v.voto as TipoVoto,
          }))}
        />
      </div>

      {/* Lista completa de votos */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-bold text-gray-900">
          Todos los votos
        </h2>
        {votosProyecto.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs font-semibold tracking-wide text-gray-500 uppercase">
                  <th className="px-4 py-3">Legislador/a</th>
                  <th className="px-4 py-3">Partido</th>
                  <th className="px-4 py-3">Voto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {votosProyecto.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/legislador/${v.legisladorId}`}
                        className="text-[#002868] hover:underline"
                      >
                        {v.legisladorNombre}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                        style={{
                          backgroundColor: v.partidoColor || '#6b7280',
                        }}
                      >
                        {v.partidoSigla}
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
        ) : (
          <p className="py-8 text-center text-gray-500">
            No se encontraron votos para este proyecto.
          </p>
        )}
      </div>
    </div>
  )
}
