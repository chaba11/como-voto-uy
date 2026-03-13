import Link from 'next/link'
import { Buscador } from '@/components/buscador'
import { obtenerEstadisticasGlobales } from '@/lib/estadisticas'
import { obtenerLeyesRecientes } from '@/lib/consultas'

export default async function Home() {
  let leyesRecientes: Awaited<ReturnType<typeof obtenerLeyesRecientes>> = []
  let globales = {
    totalLegisladores: 0,
    totalAsuntos: 0,
    totalVotosIndividuales: 0,
    totalSesiones: 0,
  }

  try {
    ;[leyesRecientes, globales] = await Promise.all([
      obtenerLeyesRecientes(6),
      obtenerEstadisticasGlobales(),
    ])
  } catch {
    // DB no disponible
  }

  return (
    <>
      <section className="bg-[#002868] py-20 text-white">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h1 className="text-5xl font-extrabold tracking-tight">
            Como Voto <span className="font-light">UY</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-blue-200">
            Asuntos canónicos, timeline de votaciones y votos individuales cuando existen
            fuentes nominales o electrónicas.
          </p>
          <div className="mx-auto mt-8 max-w-xl">
            <Buscador />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Asuntos recientes</h2>
          <Link href="/buscar?tipo=leyes" className="text-sm font-medium text-[#002868] hover:underline">
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
                <h3 className="line-clamp-2 font-semibold text-gray-900">{ley.tituloPublico}</h3>
                <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
                  <span>{ley.fecha}</span>
                  <span className="capitalize">{ley.cuerpo}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                    {ley.estadoCobertura}
                  </span>
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-[#002868]">
                    {ley.modalidad}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
            <p className="text-gray-500">No hay asuntos cargados todavía.</p>
          </div>
        )}
      </section>

      <section className="border-t border-gray-200 bg-white py-16">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:grid-cols-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-[#002868]">{globales.totalLegisladores}</div>
            <div className="mt-1 text-sm text-gray-500">Legisladores</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-[#002868]">{globales.totalAsuntos}</div>
            <div className="mt-1 text-sm text-gray-500">Asuntos</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-[#002868]">{globales.totalVotosIndividuales}</div>
            <div className="mt-1 text-sm text-gray-500">Votos individuales</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-[#002868]">{globales.totalSesiones}</div>
            <div className="mt-1 text-sm text-gray-500">Sesiones</div>
          </div>
        </div>
      </section>
    </>
  )
}