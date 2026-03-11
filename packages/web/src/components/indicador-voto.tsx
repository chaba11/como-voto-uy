import type { TipoVoto } from '@como-voto-uy/shared'

const estilos: Record<TipoVoto, string> = {
  afirmativo: 'bg-green-100 text-green-800 border-green-200',
  negativo: 'bg-red-100 text-red-800 border-red-200',
  abstencion: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  ausente: 'bg-gray-100 text-gray-600 border-gray-200',
  sin_emitir: 'bg-slate-100 text-slate-600 border-slate-200',
}

const etiquetas: Record<TipoVoto, string> = {
  afirmativo: 'Afirmativo',
  negativo: 'Negativo',
  abstencion: 'Abstención',
  ausente: 'Ausente',
  sin_emitir: 'Sin emitir',
}

export function IndicadorVoto({ voto }: { voto: TipoVoto }) {
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${estilos[voto]}`}
    >
      {etiquetas[voto]}
    </span>
  )
}
