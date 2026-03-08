import type { TipoVoto } from '@como-voto-uy/shared'

interface VotoPorPartido {
  partidoNombre: string
  partidoSigla: string
  partidoColor: string
  voto: TipoVoto
}

interface DesglosePartido {
  nombre: string
  sigla: string
  color: string
  afirmativos: number
  negativos: number
  ausentes: number
  total: number
}

export function DesglosePartido({ votos }: { votos: VotoPorPartido[] }) {
  const porPartido = votos.reduce<Record<string, DesglosePartido>>(
    (acc, v) => {
      if (!acc[v.partidoNombre]) {
        acc[v.partidoNombre] = {
          nombre: v.partidoNombre,
          sigla: v.partidoSigla,
          color: v.partidoColor,
          afirmativos: 0,
          negativos: 0,
          ausentes: 0,
          total: 0,
        }
      }
      acc[v.partidoNombre][
        v.voto === 'afirmativo'
          ? 'afirmativos'
          : v.voto === 'negativo'
            ? 'negativos'
            : 'ausentes'
      ]++
      acc[v.partidoNombre].total++
      return acc
    },
    {},
  )

  const partidosOrdenados = Object.values(porPartido).sort(
    (a, b) => b.total - a.total,
  )

  if (partidosOrdenados.length === 0) {
    return (
      <p className="py-8 text-center text-gray-500">
        No hay datos de votacion por partido.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {partidosOrdenados.map((p) => (
        <div key={p.nombre}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium text-gray-900">
              {p.nombre}{' '}
              <span className="text-gray-400">({p.sigla})</span>
            </span>
            <span className="text-gray-500">{p.total} votos</span>
          </div>
          <div className="flex h-6 overflow-hidden rounded-full bg-gray-100">
            {p.afirmativos > 0 && (
              <div
                className="flex items-center justify-center bg-green-500 text-xs font-medium text-white"
                style={{ width: `${(p.afirmativos / p.total) * 100}%` }}
                title={`${p.afirmativos} afirmativos`}
              >
                {p.afirmativos}
              </div>
            )}
            {p.negativos > 0 && (
              <div
                className="flex items-center justify-center bg-red-500 text-xs font-medium text-white"
                style={{ width: `${(p.negativos / p.total) * 100}%` }}
                title={`${p.negativos} negativos`}
              >
                {p.negativos}
              </div>
            )}
            {p.ausentes > 0 && (
              <div
                className="flex items-center justify-center bg-gray-400 text-xs font-medium text-white"
                style={{ width: `${(p.ausentes / p.total) * 100}%` }}
                title={`${p.ausentes} ausentes`}
              >
                {p.ausentes}
              </div>
            )}
          </div>
        </div>
      ))}
      <div className="flex gap-4 pt-2 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-green-500" />{' '}
          Afirmativo
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-red-500" />{' '}
          Negativo
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-gray-400" />{' '}
          Ausente
        </span>
      </div>
    </div>
  )
}
