import Link from 'next/link'

export function Nav() {
  return (
    <nav className="bg-[#002868] text-white shadow-lg">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl font-extrabold tracking-tight">
            Como Voto <span className="font-light">UY</span>
          </span>
        </Link>
        <div className="flex items-center gap-6 text-sm font-medium">
          <Link
            href="/buscar?tipo=legisladores"
            className="transition-colors hover:text-yellow-300"
          >
            Legisladores
          </Link>
          <Link
            href="/buscar?tipo=leyes"
            className="transition-colors hover:text-yellow-300"
          >
            Leyes
          </Link>
          <Link
            href="/ranking"
            className="transition-colors hover:text-yellow-300"
          >
            Ranking
          </Link>
          <Link
            href="/estadisticas"
            className="transition-colors hover:text-yellow-300"
          >
            Estadisticas
          </Link>
          <Link
            href="/buscar"
            className="rounded-md bg-white/10 px-3 py-1.5 transition-colors hover:bg-white/20"
          >
            Buscar
          </Link>
        </div>
      </div>
    </nav>
  )
}
