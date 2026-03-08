import Link from 'next/link'
import { Buscador } from '@/components/buscador'
import { TarjetaLegislador } from '@/components/tarjeta-legislador'
import {
  buscarLegisladores,
  buscarLeyes,
  obtenerPartidos,
} from '@/lib/consultas'

export default async function PaginaBuscar({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const termino = typeof params.q === 'string' ? params.q : ''
  const tipo = typeof params.tipo === 'string' ? params.tipo : 'todos'
  const partidoId = typeof params.partido === 'string' ? parseInt(params.partido, 10) : undefined
  const departamento = typeof params.departamento === 'string' ? params.departamento : undefined
  const año = typeof params.año === 'string' ? parseInt(params.año, 10) : undefined
  const camara = typeof params.camara === 'string' ? params.camara : undefined

  let resultadosLegisladores: Awaited<ReturnType<typeof buscarLegisladores>> = []
  let resultadosLeyes: Awaited<ReturnType<typeof buscarLeyes>> = []
  let partidosList: Awaited<ReturnType<typeof obtenerPartidos>> = []

  const hayBusqueda = termino || partidoId || departamento || año || camara || tipo !== 'todos'

  try {
    partidosList = await obtenerPartidos()

    if (hayBusqueda && tipo !== 'leyes') {
      resultadosLegisladores = await buscarLegisladores({
        termino: termino || undefined,
        partido: partidoId,
        departamento,
      })
    }
    if (hayBusqueda && tipo !== 'legisladores') {
      resultadosLeyes = await buscarLeyes({
        termino: termino || undefined,
        año,
        camara,
      })
    }
  } catch {
    // DB not available
  }

  const departamentos = [
    'Artigas', 'Canelones', 'Cerro Largo', 'Colonia', 'Durazno',
    'Flores', 'Florida', 'Lavalleja', 'Maldonado', 'Montevideo',
    'Paysandu', 'Rio Negro', 'Rivera', 'Rocha', 'Salto',
    'San Jose', 'Soriano', 'Tacuarembo', 'Treinta y Tres',
  ]

  function construirUrl(nuevosParams: Record<string, string>) {
    const base = new URLSearchParams()
    if (termino) base.set('q', termino)
    if (tipo !== 'todos') base.set('tipo', tipo)
    if (partidoId) base.set('partido', String(partidoId))
    if (departamento) base.set('departamento', departamento)
    if (año) base.set('año', String(año))
    if (camara) base.set('camara', camara)
    for (const [k, v] of Object.entries(nuevosParams)) {
      if (v) base.set(k, v)
      else base.delete(k)
    }
    return `/buscar?${base.toString()}`
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold text-gray-900">Buscar</h1>

      <Buscador valorInicial={termino} className="mb-6" />

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg bg-gray-100 p-1">
        {[
          { valor: 'todos', etiqueta: 'Todos' },
          { valor: 'legisladores', etiqueta: 'Legisladores' },
          { valor: 'leyes', etiqueta: 'Leyes' },
        ].map((tab) => (
          <Link
            key={tab.valor}
            href={construirUrl({ tipo: tab.valor === 'todos' ? '' : tab.valor })}
            className={`flex-1 rounded-md px-4 py-2 text-center text-sm font-medium transition-colors ${
              tipo === tab.valor
                ? 'bg-white text-[#002868] shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.etiqueta}
          </Link>
        ))}
      </div>

      {/* Filtros */}
      <div className="mb-8 flex flex-wrap gap-3">
        {tipo !== 'leyes' && (
          <>
            <select
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
              defaultValue={partidoId ? String(partidoId) : ''}
              // Using a form-based approach for server component compatibility
              name="partido"
            >
              <option value="">Todos los partidos</option>
              {partidosList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
              defaultValue={departamento || ''}
              name="departamento"
            >
              <option value="">Todos los departamentos</option>
              {departamentos.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </>
        )}
        {tipo !== 'legisladores' && (
          <select
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
            defaultValue={camara || ''}
            name="camara"
          >
            <option value="">Ambas camaras</option>
            <option value="senado">Senado</option>
            <option value="representantes">Representantes</option>
          </select>
        )}
      </div>

      {/* Resultados */}
      {!hayBusqueda ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-gray-500">
            Ingresa un termino de busqueda o selecciona un filtro para comenzar.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {/* Legisladores */}
          {tipo !== 'leyes' && (
            <section>
              <h2 className="mb-4 text-xl font-bold text-gray-900">
                Legisladores
                {resultadosLegisladores.length > 0 && (
                  <span className="ml-2 text-base font-normal text-gray-400">
                    ({resultadosLegisladores.length})
                  </span>
                )}
              </h2>
              {resultadosLegisladores.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {resultadosLegisladores.map((leg) => (
                    <TarjetaLegislador
                      key={leg.id}
                      legislador={{
                        id: leg.id,
                        nombre: leg.nombre,
                        camara: leg.camara,
                        departamento: leg.departamento,
                        partidoNombre: leg.partidoNombre,
                        partidoSigla: leg.partidoSigla,
                        partidoColor: leg.partidoColor,
                      }}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  No se encontraron legisladores.
                </p>
              )}
            </section>
          )}

          {/* Leyes */}
          {tipo !== 'legisladores' && (
            <section>
              <h2 className="mb-4 text-xl font-bold text-gray-900">
                Leyes
                {resultadosLeyes.length > 0 && (
                  <span className="ml-2 text-base font-normal text-gray-400">
                    ({resultadosLeyes.length})
                  </span>
                )}
              </h2>
              {resultadosLeyes.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {resultadosLeyes.map((ley) => (
                    <Link
                      key={ley.id}
                      href={`/ley/${ley.id}`}
                      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                    >
                      <h3 className="font-semibold text-gray-900 line-clamp-2">
                        {ley.nombre}
                      </h3>
                      <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                        <span>{ley.fecha}</span>
                        <span className="capitalize">{ley.camara}</span>
                      </div>
                      {ley.tema && (
                        <span className="mt-2 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs text-[#002868]">
                          {ley.tema}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  No se encontraron leyes.
                </p>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  )
}
