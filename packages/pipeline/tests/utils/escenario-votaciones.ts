import type Database from 'better-sqlite3'
import { eq } from 'drizzle-orm'
import {
  asuntos,
  legisladores,
  legislaturas,
  partidos,
  resultadosAgregados,
  sesiones,
  votaciones,
  votosIndividuales,
} from '@como-voto-uy/shared'
import { crearConexionEnMemoria } from '../../src/db/conexion.js'
import type { DB } from '../../src/db/conexion.js'
import { pushearSchema } from '../../src/db/migraciones.js'
import { cargarSesion } from '../../src/loader/cargador-sesion.js'

export interface ContextoPrueba {
  db: DB
  sqlite: Database.Database
  ids: {
    legislaturaId: number
    partidoFaId: number
    partidoPnId: number
    partidoSaId: number
    legisladorFaId: number
    legisladorPnId: number
  }
}

export function crearContextoPrueba(): ContextoPrueba {
  const { db, sqlite } = crearConexionEnMemoria()
  pushearSchema(sqlite)

  db.insert(partidos)
    .values([
      { id: 1, nombre: 'Frente Amplio', sigla: 'FA', color: '#2A52BE' },
      { id: 2, nombre: 'Partido Nacional', sigla: 'PN', color: '#0072CE' },
      { id: 3, nombre: 'Sin asignar', sigla: 'SA', color: '#999999' },
    ])
    .run()

  db.insert(legislaturas)
    .values({
      id: 1,
      numero: 50,
      fechaInicio: '2025-02-15',
      fechaFin: null,
    })
    .run()

  db.insert(legisladores)
    .values([
      { id: 1, nombre: 'Andrade, Oscar', partidoId: 1, camara: 'senado', departamento: 'Montevideo' },
      { id: 2, nombre: 'Bianchi, Graciela', partidoId: 2, camara: 'senado', departamento: 'Montevideo' },
    ])
    .run()

  return {
    db,
    sqlite,
    ids: {
      legislaturaId: 1,
      partidoFaId: 1,
      partidoPnId: 2,
      partidoSaId: 3,
      legisladorFaId: 1,
      legisladorPnId: 2,
    },
  }
}

export function cerrarContextoPrueba(contexto: ContextoPrueba) {
  contexto.sqlite.close()
}

export function insertarSesionNominal(contexto: ContextoPrueba) {
  cargarSesion(contexto.db, {
    legislaturaId: contexto.ids.legislaturaId,
    cuerpo: 'senado',
    fecha: '2025-04-01',
    numero: 1,
    fuente: {
      tipo: 'taquigrafica_html',
      url: 'https://parlamento.gub.uy/sesiones/1',
    },
    votaciones: [
      {
        asunto: {
          nombre: 'Proyecto de ley de transparencia',
          carpeta: '1181',
          repartido: '859',
          codigoOficial: '1181-859',
        },
        ordenSesion: 1,
        modalidad: 'nominal',
        estadoCobertura: 'individual_confirmado',
        nivelConfianza: 'alto',
        resultado: 'afirmativa',
        fuentePrincipal: {
          tipo: 'taquigrafica_html',
          url: 'https://parlamento.gub.uy/sesiones/1',
        },
        votosIndividuales: [
          {
            legisladorId: contexto.ids.legisladorFaId,
            voto: 'afirmativo',
            nivelConfianza: 'confirmado',
          },
          {
            legisladorId: contexto.ids.legisladorPnId,
            voto: 'negativo',
            nivelConfianza: 'confirmado',
          },
        ],
        resultadoAgregado: {
          afirmativos: 18,
          negativos: 13,
          totalPresentes: 31,
          unanimidad: false,
          resultado: 'afirmativa',
        },
        evidencias: [
          {
            tipo: 'texto',
            texto: 'Votación nominal del asunto carpeta 1181',
          },
        ],
      },
    ],
  })
}

export function insertarSesionAgregada(contexto: ContextoPrueba) {
  cargarSesion(contexto.db, {
    legislaturaId: contexto.ids.legislaturaId,
    cuerpo: 'senado',
    fecha: '2025-04-15',
    numero: 2,
    fuente: {
      tipo: 'taquigrafica_html',
      url: 'https://parlamento.gub.uy/sesiones/2',
    },
    votaciones: [
      {
        asunto: {
          nombre: 'Levantamiento del receso',
          codigoOficial: 'receso-2025',
        },
        ordenSesion: 1,
        modalidad: 'ordinaria',
        estadoCobertura: 'agregado',
        nivelConfianza: 'alto',
        resultado: 'afirmativa',
        resultadoAgregado: {
          afirmativos: 28,
          negativos: 0,
          totalPresentes: 28,
          unanimidad: true,
          resultado: 'afirmativa',
        },
      },
    ],
  })
}

export function insertarSesionRepresentantes(contexto: ContextoPrueba) {
  const abdala = contexto.db
    .insert(legisladores)
    .values({
      nombre: 'Abdala, Pablo D.',
      partidoId: contexto.ids.partidoFaId,
      camara: 'representantes',
      departamento: 'Montevideo',
    })
    .returning({ id: legisladores.id })
    .get()

  const gandini = contexto.db
    .insert(legisladores)
    .values({
      nombre: 'Gandini, Jorge A.',
      partidoId: contexto.ids.partidoPnId,
      camara: 'representantes',
      departamento: 'Montevideo',
    })
    .returning({ id: legisladores.id })
    .get()

  cargarSesion(contexto.db, {
    legislaturaId: contexto.ids.legislaturaId,
    cuerpo: 'representantes',
    fecha: '2025-05-05',
    numero: 5,
    fuente: {
      tipo: 'json',
      url: 'https://documentos.diputados.gub.uy/docs/DAvotaciones.json',
    },
    votaciones: [
      {
        asunto: {
          nombre: 'Proyecto de ley sobre datos abiertos',
        },
        ordenSesion: 1,
        modalidad: 'electronica',
        estadoCobertura: 'individual_confirmado',
        nivelConfianza: 'alto',
        resultado: 'afirmativa',
        votosIndividuales: [
          { legisladorId: abdala.id, voto: 'afirmativo', nivelConfianza: 'confirmado' },
          { legisladorId: gandini.id, voto: 'negativo', nivelConfianza: 'confirmado' },
        ],
        resultadoAgregado: {
          afirmativos: 60,
          negativos: 39,
          totalPresentes: 99,
          resultado: 'afirmativa',
        },
      },
    ],
  })
}

export function obtenerPrimerAsuntoId(contexto: ContextoPrueba): number {
  return contexto.db.select({ id: asuntos.id }).from(asuntos).get()!.id
}

export function obtenerPrimeraVotacionId(contexto: ContextoPrueba): number {
  return contexto.db.select({ id: votaciones.id }).from(votaciones).get()!.id
}

export function obtenerResumenPrimeraVotacion(contexto: ContextoPrueba) {
  const votacion = contexto.db.select().from(votaciones).get()!
  const resultado = contexto.db
    .select()
    .from(resultadosAgregados)
    .where(eq(resultadosAgregados.votacionId, votacion.id))
    .get()
  const votos = contexto.db
    .select()
    .from(votosIndividuales)
    .where(eq(votosIndividuales.votacionId, votacion.id))
    .all()

  return { votacion, resultado, votos }
}

export function obtenerTotalSesiones(contexto: ContextoPrueba): number {
  return contexto.db.select().from(sesiones).all().length
}
