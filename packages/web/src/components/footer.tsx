export function Footer() {
  return (
    <footer className="mt-auto border-t border-gray-200 bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div>
            <p className="text-sm text-gray-600">
              Datos del{' '}
              <a
                href="https://parlamento.gub.uy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[#002868] underline hover:text-[#001a4a]"
              >
                Parlamento del Uruguay
              </a>
            </p>
          </div>
          <div className="text-xs text-gray-400">
            Proyecto de transparencia legislativa
          </div>
        </div>
      </div>
    </footer>
  )
}
