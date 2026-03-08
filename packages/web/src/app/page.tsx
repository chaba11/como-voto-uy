import Link from 'next/link'
import { Buscador } from '@/components/buscador'
import { obtenerLeyesRecientes } from '@/lib/consultas'

export default async function Home() {
  let leyesRecientes: Awaited<ReturnType<typeof obtenerLeyesRecientes>> = []
  try {
    leyesRecientes = await obtenerLeyesRecientes(6)
  } catch {
    // DB not available
  }

  return (
    <>
      {/* Hero */}
      <section className="bg-[#002868] py-20 text-white">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h1 className="text-5xl font-extrabold tracking-tight">
            Como Voto <span className="font-light">UY</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-blue-200">
            Consulta como votaron los legisladores uruguayos en cada proyecto de
            ley. Transparencia legislativa al alcance de todos.
          </p>
          <div className="mx-auto mt-8 max-w-xl">
            <Buscador />
          </div>
        </div>
      </section>

      {/* Leyes recientes */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            Votaciones recientes
          </h2>
          <Link
            href="/buscar?tipo=leyes"
            className="text-sm font-medium text-[#002868] hover:underline"
          >
            Ver todas
          </Link>
        </div>

        {leyesRecientes.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {leyesRecientes.map((ley) => (
              <Link
                key={ley.id}
                href={`/ley/${ley.id}`}
                className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <h3 className="font-semibold text-gray-900 line-clamp-2">
                  {ley.nombre}
                </h3>
                <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
                  <span>{ley.fecha}</span>
                  <span className="capitalize">{ley.camara}</span>
                </div>
                {ley.resultado && (
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        ley.resultado === 'afirmativa'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {ley.resultado === 'afirmativa' ? 'Aprobada' : 'Rechazada'}
                    </span>
                    {ley.resultadoAfirmativos != null && ley.resultadoTotal != null && (
                      <span className="text-xs text-gray-400">
                        {ley.resultadoAfirmativos}/{ley.resultadoTotal}
                      </span>
                    )}
                    {ley.unanimidad && (
                      <span className="text-xs text-gray-400">unanimidad</span>
                    )}
                  </div>
                )}
                {ley.tema && (
                  <span className="mt-2 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs text-[#002868]">
                    {ley.tema}
                  </span>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
            <p className="text-gray-500">
              No hay votaciones disponibles aun. Ejecuta el pipeline para
              cargar datos.
            </p>
          </div>
        )}
      </section>

      {/* Stats / CTA */}
      <section className="border-t border-gray-200 bg-white py-16">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:grid-cols-3">
          <div className="text-center">
            <div className="text-3xl font-bold text-[#002868]">130</div>
            <div className="mt-1 text-sm text-gray-500">Legisladores</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-[#002868]">2</div>
            <div className="mt-1 text-sm text-gray-500">Camaras</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-[#002868]">50a</div>
            <div className="mt-1 text-sm text-gray-500">Legislatura</div>
          </div>
        </div>
      </section>
    </>
  )
}
