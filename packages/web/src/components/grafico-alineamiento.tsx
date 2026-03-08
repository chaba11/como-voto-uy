export function GraficoAlineamiento({ valor, label }: { valor: number; label: string }) {
  const color =
    valor > 80
      ? 'bg-green-500'
      : valor >= 50
        ? 'bg-yellow-500'
        : 'bg-red-500'

  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="font-semibold text-gray-900">{valor}%</span>
      </div>
      <div className="h-4 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${valor}%` }}
        />
      </div>
    </div>
  )
}
