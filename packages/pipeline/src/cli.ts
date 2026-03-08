import { crearConexion } from './db/conexion.js'
import { pushearSchema } from './db/migraciones.js'
import { seedPartidos } from './seed/partidos.js'
import { seedLegislaturas } from './seed/legislaturas.js'
import { cargarConfig } from './config.js'
import { ejecutarPipeline } from './pipeline.js'
import { obtenerListadoSesiones } from './scraper/listado.js'
import { descargarDocumento } from './scraper/descargador.js'
import { parsearTaquigrafica } from './parser/index.js'
import type { Camara } from '@como-voto-uy/shared'

const comando = process.argv[2]
const config = cargarConfig()

function parsearOpciones(): {
  camara: Camara
  legislatura: number
  limite?: number
} {
  const camaraArg = process.argv.find((a) => a.startsWith('--camara='))
  const legArg = process.argv.find((a) => a.startsWith('--legislatura='))
  const limiteArg = process.argv.find((a) => a.startsWith('--limite='))

  const camara = (camaraArg?.split('=')[1] || 'senado') as Camara
  const legislatura = parseInt(legArg?.split('=')[1] || '50', 10)
  const limite = limiteArg ? parseInt(limiteArg.split('=')[1], 10) : undefined

  if (camara !== 'senado' && camara !== 'representantes') {
    console.error('La cámara debe ser "senado" o "representantes"')
    process.exit(1)
  }

  return { camara, legislatura, limite }
}

async function main() {
  switch (comando) {
    case 'seed': {
      const { db, sqlite } = crearConexion(config.rutaDb)
      pushearSchema(sqlite)
      seedPartidos(db)
      seedLegislaturas(db)
      console.log('Seed completado')
      sqlite.close()
      break
    }

    case 'scrape': {
      const { camara, legislatura, limite } = parsearOpciones()
      console.log(
        `Obteniendo listado de sesiones: ${camara}, legislatura ${legislatura}...`,
      )
      const entradas = await obtenerListadoSesiones(camara, legislatura)
      const entradasAProcesar = limite ? entradas.slice(0, limite) : entradas

      console.log(`Sesiones encontradas: ${entradas.length}`)

      for (const entrada of entradasAProcesar) {
        console.log(
          `  Sesión ${entrada.sesionNumero} - ${entrada.fecha} (${entrada.tipoDocumento})`,
        )
      }

      console.log(
        `\nMostrando ${entradasAProcesar.length} de ${entradas.length} sesiones`,
      )
      break
    }

    case 'parse': {
      const { camara, legislatura, limite } = parsearOpciones()
      console.log(
        `Descargando y parseando sesiones: ${camara}, legislatura ${legislatura}...`,
      )
      const entradas = await obtenerListadoSesiones(camara, legislatura)
      const entradasAProcesar = limite ? entradas.slice(0, limite) : entradas

      for (const entrada of entradasAProcesar) {
        try {
          console.log(
            `\n  Descargando sesión ${entrada.sesionNumero} (${entrada.fecha})...`,
          )
          const documento = await descargarDocumento(entrada)
          const resultado = parsearTaquigrafica(documento.contenido)
          console.log(
            `    Votaciones: ${resultado.votaciones.length} (nominales: ${resultado.votaciones.filter((v) => v.tipo === 'nominal').length}, agregadas: ${resultado.votaciones.filter((v) => v.tipo === 'agregada').length})`,
          )
          console.log(
            `    Asistentes: ${resultado.asistentes.length}, Ausentes: ${resultado.ausentes.length}`,
          )
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          console.error(
            `    Error procesando sesión ${entrada.sesionNumero}: ${msg}`,
          )
        }
      }
      break
    }

    case 'load': {
      // Load ejecuta el pipeline completo pero es equivalente a 'all'
      // ya que necesita scrape + parse para poder cargar
      const { camara, legislatura, limite } = parsearOpciones()
      const resultado = await ejecutarPipeline({
        camara,
        legislatura,
        rutaDb: config.rutaDb,
        limite,
      })
      console.log(
        `\nCarga completada: ${resultado.sesionesNuevas} sesiones nuevas, ${resultado.sesionesConError} errores`,
      )
      break
    }

    case 'all': {
      const { camara, legislatura, limite } = parsearOpciones()
      const resultado = await ejecutarPipeline({
        camara,
        legislatura,
        rutaDb: config.rutaDb,
        limite,
      })
      console.log(
        `\nPipeline completado: ${resultado.sesionesNuevas} sesiones nuevas, ${resultado.votacionesExtraidas} votaciones`,
      )
      break
    }

    default:
      console.log(
        'Uso: cli <seed|scrape|parse|load|all> [--camara=senado|representantes] [--legislatura=50] [--limite=N]',
      )
      process.exit(1)
  }
}

main().catch(console.error)
