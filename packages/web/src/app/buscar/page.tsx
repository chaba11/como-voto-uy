import Link from 'next/link'
import { Buscador } from '@/components/buscador'
import { TarjetaLegislador } from '@/components/tarjeta-legislador'
import { buscarLegisladores, buscarLeyes } from '@/lib/consultas'

export default async function PaginaBuscar({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const termino = typeof params.q === 'string' ? params.q : ''
  const tipo = typeof params.tipo === 'string' ? params.tipo : 'todos'
  const cuerpo = typeof params.cuerpo === 'string' ? params.cuerpo : undefined
  const año = typeof params.año === 'string' ? parseInt(params.año, 10) : undefined

  const hayBusqueda = Boolean(termino || cuerpo || año || tipo !== 'todos')

  const [legisladores, leyes] = hayBusqueda
    ? await Promise.all([
        tipo !== 'leyes'
          ? buscarLegisladores({ termino: termino || undefined })
          : Promise.resolve([]),
        tipo !== 'legisladores'
          ? buscarLeyes({ termino: termino || undefined, cuerpo, año })
          : Promise.resolve([]),
      ])
    : [[], []]

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold text-gray-900">Buscar</h1>
      <Buscador valorInicial={termino} className="mb-6" />

      <div className="mb-8 flex gap-2">
        <Link href={`/buscar?q=${encodeURIComponent(termino)}`} className="rounded-full bg-white px-3 py-1 text-sm shadow-sm">
          Todos
        </Link>
        <Link href={`/buscar?q=${encodeURIComponent(termino)}&tipo=legisladores`} className="rounded-full bg-white px-3 py-1 text-sm shadow-sm">
          Legisladores
        </Link>
        <Link href={`/buscar?q=${encodeURIComponent(termino)}&tipo=leyes`} className="rounded-full bg-white px-3 py-1 text-sm shadow-sm">
          Asuntos
        </Link>
      </div>

      {!hayBusqueda ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-gray-500">Ingresá un término para empezar.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {tipo !== 'leyes' && (
            <section>
              <h2 className="mb-4 text-xl font-bold text-gray-900">Legisladores</h2>
              {legisladores.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {legisladores.map((legislador) => (
                    <TarjetaLegislador
                      key={legislador.id}
                      legislador={{
                        id: legislador.id,
                        nombre: legislador.nombre,
                        camara: legislador.camara,
                        departamento: legislador.departamento,
                        partidoNombre: legislador.partidoNombre,
                        partidoSigla: legislador.partidoSigla,
                        partidoColor: legislador.partidoColor,
                      }}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No se encontraron legisladores.</p>
              )}
            </section>
          )}

          {tipo !== 'legisladores' && (
            <section>
              <h2 className="mb-4 text-xl font-bold text-gray-900">Asuntos / leyes</h2>
              {leyes.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {leyes.map((ley) => (
                    <Link
                      key={ley.id}
                      href={`/ley/${ley.id}`}
                      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                    >
                      <h3 className="font-semibold text-gray-900">{ley.tituloPublico}</h3>
                      {(ley.origenTitulo === 'identificador' || ley.calidadTitulo === 'incompleto') && (
                        <p className="mt-1 text-xs text-amber-700">Título incompleto</p>
                      )}
                      <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                        <span>{ley.fecha}</span>
                        <span className="capitalize">{ley.cuerpo}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No se encontraron asuntos.</p>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  )
}