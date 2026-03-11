import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LEGISLATURAS } from '@como-voto-uy/shared'
import {
  obtenerIntegracionHistoricaParlamento,
  obtenerAfiliacionesCuradasLocales,
} from '../scraper/afiliaciones-legisladores.js'

const DIR_BASE = fileURLToPath(new URL('..', import.meta.url))
const RUTA_DESTINO = join(DIR_BASE, 'datos', 'afiliaciones', 'senado-curado.csv')

function escaparCsv(valor: string | number | null | undefined): string {
  const texto = String(valor ?? '')
  if (/[",\n]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`
  }
  return texto
}

async function main() {
  const legislaturas = LEGISLATURAS.filter((legislatura) =>
    [46, 47, 48, 49].includes(legislatura.numero),
  ).map((legislatura) => legislatura.numero)

  const existentes = obtenerAfiliacionesCuradasLocales().filter(
    (registro) => registro.camara === 'senado' && !legislaturas.includes(registro.legislatura),
  )

  const generados = []
  for (const legislatura of legislaturas) {
    const registros = await obtenerIntegracionHistoricaParlamento(
      legislatura,
      'senado',
      {
        cadaDias: 14,
        concurrencia: 16,
      },
    )
    generados.push(...registros)
    console.log(`Legislatura ${legislatura}: ${registros.length} afiliaciones curadas`)
  }

  const registros = [...existentes, ...generados].sort((a, b) => {
    if (a.legislatura !== b.legislatura) return a.legislatura - b.legislatura
    return a.nombre.localeCompare(b.nombre, 'es')
  })

  const lineas = [
    'nombre,camara,legislatura,sigla_partido,tipo_registro,fuente_url,fuente_tipo,metodo,nivel_confianza',
    ...registros.map((registro) =>
      [
        registro.nombre,
        registro.camara,
        registro.legislatura,
        registro.siglaPartido,
        registro.tipoRegistro,
        registro.fuente.url,
        registro.fuente.tipo,
        registro.metodo,
        registro.nivelConfianza,
      ]
        .map((valor) => escaparCsv(valor))
        .join(','),
    ),
  ]

  mkdirSync(dirname(RUTA_DESTINO), { recursive: true })
  writeFileSync(RUTA_DESTINO, `${lineas.join('\n')}\n`, 'utf8')
  console.log(`Archivo generado en ${RUTA_DESTINO}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
