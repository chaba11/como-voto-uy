import Link from 'next/link'

interface DatosLegislador {
  id: number
  nombre: string
  camara: string
  departamento: string | null
  partidoNombre: string
  partidoSigla: string
  partidoColor: string
}

export function TarjetaLegislador({ legislador }: { legislador: DatosLegislador }) {
  return (
    <Link
      href={`/legislador/${legislador.id}`}
      className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">{legislador.nombre}</h3>
          <p className="mt-1 text-sm text-gray-500 capitalize">
            {legislador.camara === 'senado' ? 'Senador/a' : 'Representante'}
            {legislador.departamento && ` - ${legislador.departamento}`}
          </p>
        </div>
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
          style={{ backgroundColor: legislador.partidoColor || '#6b7280' }}
        >
          {legislador.partidoSigla}
        </span>
      </div>
    </Link>
  )
}
