import Link from 'next/link'
import { Buscador } from '@/components/buscador'
import { Paginacion } from '@/components/paginacion'
import { TarjetaAsunto } from '@/components/tarjeta-asunto'
import { TarjetaLegislador } from '@/components/tarjeta-legislador'
import { buscarLegisladores, buscarLeyes, obtenerPartidos } from '@/lib/consultas'

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
  const camaraFiltro = typeof params.camara === 'string' ? params.camara : undefined
  const partidoFiltro = typeof params.partido === 'string' ? parseInt(params.partido, 10) : undefined
  const pagLeg = typeof params.pagLeg === 'string' ? parseInt(params.pagLeg, 10) : 1
  const pagLey = typeof params.pagLey === 'string' ? parseInt(params.pagLey, 10) : 1

  const hayBusqueda = Boolean(termino || cuerpo || año || tipo !== 'todos' || camaraFiltro || partidoFiltro)

  const [resultadoLeg, resultadoLey, partidos] = hayBusqueda
    ? await Promise.all([
        tipo !== 'leyes'
          ? buscarLegisladores({
              termino: termino || undefined,
              camara: camaraFiltro,
              partido: partidoFiltro && !Number.isNaN(partidoFiltro) ? partidoFiltro : undefined,
              pagina: pagLeg,
            })
          : Promise.resolve({ datos: [], total: 0 }),
        tipo !== 'legisladores'
          ? buscarLeyes({ termino: termino || undefined, cuerpo, año, pagina: pagLey })
          : Promise.resolve({ datos: [], total: 0 }),
        obtenerPartidos(),
      ])
    : [{ datos: [], total: 0 }, { datos: [], total: 0 }, await obtenerPartidos()]

  const totalPaginasLeg = Math.ceil(resultadoLeg.total / 24)
  const totalPaginasLey = Math.ceil(resultadoLey.total / 20)

  const searchParamsPlanos: Record<string, string | undefined> = {
    q: termino || undefined,
    tipo: tipo !== 'todos' ? tipo : undefined,
    cuerpo,
    año: año ? String(año) : undefined,
    camara: camaraFiltro,
    partido: partidoFiltro ? String(partidoFiltro) : undefined,
  }

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

      {(tipo === 'legisladores' || tipo === 'todos') && (
        <div className="mb-6 rounded-xl bg-white p-4 shadow-sm">
          <form className="flex flex-wrap items-end gap-4">
            <input type="hidden" name="q" value={termino} />
            {tipo !== 'todos' && <input type="hidden" name="tipo" value={tipo} />}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Cámara</label>
              <select name="camara" defaultValue={camaraFiltro || ''} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="">Todas</option>
                <option value="senado">Senado</option>
                <option value="representantes">Representantes</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Partido</label>
              <select name="partido" defaultValue={partidoFiltro ? String(partidoFiltro) : ''} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
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
      )}

      {!hayBusqueda ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-gray-500">Ingresá un término para empezar.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {tipo !== 'leyes' && (
            <section>
              <h2 className="mb-4 text-xl font-bold text-gray-900">
                Legisladores
                {resultadoLeg.total > 0 && <span className="ml-2 text-sm font-normal text-gray-400">({resultadoLeg.total})</span>}
              </h2>
              {resultadoLeg.datos.length > 0 ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {resultadoLeg.datos.map((legislador) => (
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
                  <Paginacion
                    paginaActual={pagLeg}
                    totalPaginas={totalPaginasLeg}
                    searchParams={searchParamsPlanos}
                    paramPagina="pagLeg"
                  />
                </>
              ) : (
                <p className="text-sm text-gray-500">No se encontraron legisladores.</p>
              )}
            </section>
          )}

          {tipo !== 'legisladores' && (
            <section>
              <h2 className="mb-4 text-xl font-bold text-gray-900">
                Asuntos / leyes
                {resultadoLey.total > 0 && <span className="ml-2 text-sm font-normal text-gray-400">({resultadoLey.total})</span>}
              </h2>
              {resultadoLey.datos.length > 0 ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {resultadoLey.datos.map((ley) => (
                      <TarjetaAsunto key={ley.id} asunto={ley} />
                    ))}
                  </div>
                  <Paginacion
                    paginaActual={pagLey}
                    totalPaginas={totalPaginasLey}
                    searchParams={searchParamsPlanos}
                    paramPagina="pagLey"
                  />
                </>
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
