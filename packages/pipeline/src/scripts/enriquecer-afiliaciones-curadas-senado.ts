import { and, eq } from 'drizzle-orm'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { legisladores, legislaturas, partidos } from '@como-voto-uy/shared'
import { crearConexionEnMemoria } from '../db/conexion.js'
import { pushearSchema } from '../db/migraciones.js'
import { cargarAfiliacionesHistoricas } from '../loader/cargador-afiliaciones.js'
import {
  URL_DIRECTORIO_LEGISLADORES,
  extraerAfiliacionesPerfilLegisladorDesdeHtml,
  extraerResultadosBusquedaLegisladoresDesdeHtml,
  normalizarNombreFuente,
  parsearAfiliacionesCuradasCsv,
} from '../scraper/afiliaciones-legisladores.js'
import { seedLegisladores } from '../seed/legisladores.js'
import { seedLegislaturas } from '../seed/legislaturas.js'
import { seedPartidos } from '../seed/partidos.js'
import { fetchConReintentos } from '../utils/http.js'

const DIR_BASE = fileURLToPath(new URL('..', import.meta.url))
const RUTA_DESTINO = join(DIR_BASE, 'datos', 'afiliaciones', 'senado-curado.csv')

function escaparCsv(valor: string | number | null | undefined): string {
  const texto = String(valor ?? '')
  if (/[",\n]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`
  }
  return texto
}

function normalizarClaveNombre(nombre: string): string {
  return normalizarNombreFuente(nombre)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase()
}

async function buscarPerfil(nombre: string): Promise<number | null> {
  const url = `${URL_DIRECTORIO_LEGISLADORES}?keys=${encodeURIComponent(
    nombre.replace(',', ' '),
  )}`
  const respuesta = await fetchConReintentos(url)
  if (!respuesta.ok) return null
  const html = await respuesta.text()
  const resultados = extraerResultadosBusquedaLegisladoresDesdeHtml(html)
  const claveObjetivo = normalizarClaveNombre(nombre)

  const exacto = resultados.find(
    (resultado) => normalizarClaveNombre(resultado.nombre) === claveObjetivo,
  )
  if (exacto) return exacto.id

  return resultados[0]?.id ?? null
}

async function resolverPendiente(
  nombre: string,
  legislatura: number,
): Promise<{
  nombre: string
  legislatura: number
  siglaPartido: string
  fuenteUrl: string
} | null> {
  const id = await buscarPerfil(nombre)
  if (!id) return null

  const url = `${URL_DIRECTORIO_LEGISLADORES}/${id}`
  const respuesta = await fetchConReintentos(url)
  if (!respuesta.ok) return null
  const html = await respuesta.text()
  const afiliaciones = extraerAfiliacionesPerfilLegisladorDesdeHtml(html)
  const afiliacion =
    afiliaciones.find(
      (item) => item.legislatura === legislatura && item.camara === 'senado' && item.siglaPartido,
    ) ??
    afiliaciones.find((item) => item.legislatura === legislatura && item.siglaPartido)

  const siglaPartido =
    afiliacion?.siglaPartido ??
    (() => {
      const unicas = [...new Set(afiliaciones.map((item) => item.siglaPartido).filter(Boolean))]
      return unicas.length === 1 ? unicas[0] ?? null : null
    })()

  if (!siglaPartido) return null

  return {
    nombre: normalizarNombreFuente(nombre),
    legislatura,
    siglaPartido,
    fuenteUrl: url,
  }
}

async function main() {
  const textoActual = readFileSync(RUTA_DESTINO, 'utf8')
  const registrosActuales = parsearAfiliacionesCuradasCsv(textoActual)
  const clavesActuales = new Set(
    registrosActuales
      .filter((registro) => registro.camara === 'senado')
      .map((registro) => `${registro.legislatura}:${normalizarClaveNombre(registro.nombre)}`),
  )

  const { db, sqlite } = crearConexionEnMemoria()
  pushearSchema(sqlite)
  seedPartidos(db)
  seedLegislaturas(db)
  seedLegisladores(db)
  await cargarAfiliacionesHistoricas(db, {
    camara: 'senado',
    legislaturas: [46, 47, 48, 49, 50],
    incluirCurado: true,
  })

  const partidoSa = db
    .select({ id: partidos.id })
    .from(partidos)
    .where(eq(partidos.sigla, 'SA'))
    .get()

  const pendientes = db
    .select({
      nombre: legisladores.nombre,
      legislatura: legislaturas.numero,
    })
    .from(legisladores)
    .innerJoin(legislaturas, eq(legisladores.legislaturaId, legislaturas.id))
    .where(
      and(
        eq(legisladores.camara, 'senado'),
        eq(legisladores.partidoId, partidoSa?.id ?? -1),
      ),
    )
    .all()
    .filter((item) => item.legislatura >= 46 && item.legislatura <= 49)
    .filter(
      (item) => !clavesActuales.has(`${item.legislatura}:${normalizarClaveNombre(item.nombre)}`),
    )
    .sort((a, b) => a.legislatura - b.legislatura || a.nombre.localeCompare(b.nombre, 'es'))

  sqlite.close()

  const nuevos = []
  for (const pendiente of pendientes) {
    const resuelto = await resolverPendiente(pendiente.nombre, pendiente.legislatura)
    if (!resuelto) {
      console.log(`Sin resolver: ${pendiente.legislatura} - ${pendiente.nombre}`)
      continue
    }
    console.log(
      `Resuelto: ${resuelto.legislatura} - ${resuelto.nombre} -> ${resuelto.siglaPartido}`,
    )
    nuevos.push(resuelto)
    clavesActuales.add(`${resuelto.legislatura}:${normalizarClaveNombre(resuelto.nombre)}`)
  }

  const lineas = [
    'nombre,camara,legislatura,sigla_partido,tipo_registro,fuente_url,fuente_tipo,metodo,nivel_confianza',
    ...[
      ...registrosActuales.map((registro) => ({
        nombre: registro.nombre,
        camara: registro.camara,
        legislatura: registro.legislatura,
        siglaPartido: registro.siglaPartido ?? '',
        tipoRegistro: registro.tipoRegistro,
        fuenteUrl: registro.fuente.url,
        fuenteTipo: registro.fuente.tipo,
        metodo: registro.metodo,
        nivelConfianza: registro.nivelConfianza,
      })),
      ...nuevos.map((registro) => ({
        nombre: registro.nombre,
        camara: 'senado',
        legislatura: registro.legislatura,
        siglaPartido: registro.siglaPartido,
        tipoRegistro: 'integrante_temporal',
        fuenteUrl: registro.fuenteUrl,
        fuenteTipo: 'manual',
        metodo: 'biografia',
        nivelConfianza: 'alto',
      })),
    ]
      .sort((a, b) => {
        if (a.legislatura !== b.legislatura) return a.legislatura - b.legislatura
        return a.nombre.localeCompare(b.nombre, 'es')
      })
      .map((registro) =>
        [
          registro.nombre,
          registro.camara,
          registro.legislatura,
          registro.siglaPartido,
          registro.tipoRegistro,
          registro.fuenteUrl,
          registro.fuenteTipo,
          registro.metodo,
          registro.nivelConfianza,
        ]
          .map((valor) => escaparCsv(valor))
          .join(','),
      ),
  ]

  writeFileSync(RUTA_DESTINO, `${lineas.join('\n')}\n`, 'utf8')
  console.log(`Nuevas filas agregadas: ${nuevos.length}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
