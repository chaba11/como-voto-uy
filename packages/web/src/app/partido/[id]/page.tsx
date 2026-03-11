import Link from 'next/link'
import { notFound } from 'next/navigation'
import { obtenerPartidoDetalle } from '@/lib/consultas'

export default async function PaginaPartido({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const partidoId = parseInt(id, 10)
  if (Number.isNaN(partidoId)) notFound()

  const detalle = await obtenerPartidoDetalle(partidoId)
  if (!detalle) notFound()

  const afirmativos = detalle.votos.filter((voto) => voto.voto === 'afirmativo').length
  const negativos = detalle.votos.filter((voto) => voto.voto === 'negativo').length
  const ausentes = detalle.votos.filter((voto) => voto.voto === 'ausente').length

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 rounded-xl bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <span
            className="rounded-full px-4 py-1.5 text-sm font-semibold text-white"
            style={{ backgroundColor: detalle.partido.color || '#6b7280' }}
          >
            {detalle.partido.sigla}
          </span>
          <h1 className="text-3xl font-bold text-gray-900">{detalle.partido.nombre}</h1>
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-4">
        <div className="rounded-lg bg-white p-4 text-center shadow-sm">
          <div className="text-2xl font-bold text-gray-900">{detalle.miembros.length}</div>
          <div className="text-xs text-gray-500">Miembros</div>
        </div>
        <div className="rounded-lg bg-white p-4 text-center shadow-sm">
          <div className="text-2xl font-bold text-green-600">{afirmativos}</div>
          <div className="text-xs text-gray-500">Afirmativos</div>
        </div>
        <div className="rounded-lg bg-white p-4 text-center shadow-sm">
          <div className="text-2xl font-bold text-red-600">{negativos}</div>
          <div className="text-xs text-gray-500">Negativos</div>
        </div>
        <div className="rounded-lg bg-white p-4 text-center shadow-sm">
          <div className="text-2xl font-bold text-slate-600">{ausentes}</div>
          <div className="text-xs text-gray-500">Ausentes</div>
        </div>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-bold text-gray-900">Legisladores</h2>
        <ul className="space-y-2">
          {detalle.miembros.map((miembro) => (
            <li key={miembro.id}>
              <Link
                href={`/legislador/${miembro.id}`}
                className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-gray-50"
              >
                <span className="font-medium text-[#002868]">{miembro.nombre}</span>
                <span className="text-xs capitalize text-gray-400">{miembro.camara}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
