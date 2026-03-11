import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { TipoVoto } from '@como-voto-uy/shared'
import { DesglosePartido } from '@/components/desglose-partido'
import { IndicadorVoto } from '@/components/indicador-voto'
import { obtenerAsuntoConVotaciones } from '@/lib/consultas'

export default async function PaginaLey({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const asuntoId = parseInt(id, 10)
  if (Number.isNaN(asuntoId)) notFound()

  const asunto = await obtenerAsuntoConVotaciones(asuntoId)
  if (!asunto) notFound()

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-gray-900">{asunto.nombre}</h1>
        {asunto.descripcion && <p className="mt-2 text-gray-600">{asunto.descripcion}</p>}
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
            título {asunto.calidadTitulo}
          </span>
          {asunto.numeroLey && (
            <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
              Ley {asunto.numeroLey}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {asunto.votaciones.map((votacion) => (
          <section key={votacion.id} className="rounded-xl bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                {votacion.fecha}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 capitalize">
                {votacion.cuerpo}
              </span>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-[#002868]">
                {votacion.modalidad}
              </span>
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                confianza {votacion.nivelConfianza}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                {votacion.estadoCobertura}
              </span>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-4">
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-sm text-gray-500">Resultado</div>
                <div className="font-semibold text-gray-900">{votacion.resultado ?? 'Sin dato'}</div>
              </div>
              <div className="rounded-lg bg-green-50 p-3">
                <div className="text-sm text-green-700">Afirmativos</div>
                <div className="font-semibold text-green-800">{votacion.afirmativos ?? '-'}</div>
              </div>
              <div className="rounded-lg bg-red-50 p-3">
                <div className="text-sm text-red-700">Negativos</div>
                <div className="font-semibold text-red-800">{votacion.negativos ?? '-'}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-sm text-gray-500">Presentes</div>
                <div className="font-semibold text-gray-900">{votacion.totalPresentes ?? '-'}</div>
              </div>
            </div>

            {votacion.votosIndividuales.length > 0 ? (
              <>
                <div className="mt-6">
                  <h3 className="mb-3 text-lg font-semibold text-gray-900">Desglose por partido</h3>
                  <DesglosePartido
                    votos={votacion.votosIndividuales.map((voto) => ({
                      partidoNombre: voto.legislador.partido.nombre,
                      partidoSigla: voto.legislador.partido.sigla,
                      partidoColor: voto.legislador.partido.color,
                      voto: voto.voto as TipoVoto,
                    }))}
                  />
                </div>

                <div className="mt-6 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-xs font-semibold tracking-wide text-gray-500 uppercase">
                        <th className="px-4 py-3">Legislador/a</th>
                        <th className="px-4 py-3">Partido</th>
                        <th className="px-4 py-3">Confianza</th>
                        <th className="px-4 py-3">Voto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {votacion.votosIndividuales.map((voto) => (
                        <tr key={voto.id}>
                          <td className="px-4 py-3">
                            <Link href={`/legislador/${voto.legislador.id}`} className="text-[#002868] hover:underline">
                              {voto.legislador.nombre}
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            {voto.legislador.partido.sigla === 'SA' ? (
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                                Pendiente
                              </span>
                            ) : (
                              <span
                                className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                                style={{ backgroundColor: voto.legislador.partido.color || '#6b7280' }}
                              >
                                {voto.legislador.partido.sigla}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                              {voto.nivelConfianza}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <IndicadorVoto voto={voto.voto as TipoVoto} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="mt-6 text-sm text-gray-500">
                Esta votación solo tiene resultado agregado o no publica desglose individual.
              </p>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}
