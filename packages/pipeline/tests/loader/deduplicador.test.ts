import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { legisladores } from '@como-voto-uy/shared'
import { sesionExiste, legisladorExiste } from '../../src/loader/deduplicador.js'
import {
  cerrarContextoPrueba,
  crearContextoPrueba,
  insertarSesionNominal,
} from '../utils/escenario-votaciones.js'

describe('deduplicador', () => {
  const contexto = crearContextoPrueba()

  afterEach(() => {
    contexto.sqlite.exec('DELETE FROM evidencias; DELETE FROM votos_individuales; DELETE FROM resultados_agregados; DELETE FROM votaciones; DELETE FROM asuntos; DELETE FROM sesiones;')
  })

  describe('sesionExiste', () => {
    it('retorna false si la sesión no existe', () => {
      expect(sesionExiste(contexto.db, 'senado', '2025-03-15', 1)).toBe(false)
    })

    it('retorna true si la sesión ya fue cargada', () => {
      insertarSesionNominal(contexto)
      expect(sesionExiste(contexto.db, 'senado', '2025-04-01', 1)).toBe(true)
    })

    it('no confunde cuerpos distintos', () => {
      insertarSesionNominal(contexto)
      expect(sesionExiste(contexto.db, 'representantes', '2025-04-01', 1)).toBe(false)
    })
  })

  describe('legisladorExiste', () => {
    it('retorna null si el legislador no existe', () => {
      expect(legisladorExiste(contexto.db, 'Nadie', 'senado')).toBeNull()
    })

    it('retorna el id si el legislador existe', () => {
      expect(legisladorExiste(contexto.db, 'Andrade, Oscar', 'senado')).toBe(
        contexto.ids.legisladorFaId,
      )
    })

    it('no confunde legisladores de cámaras distintas', () => {
      contexto.db.insert(legisladores)
        .values({
          nombre: 'Andrade, Oscar',
          partidoId: contexto.ids.partidoFaId,
          camara: 'representantes',
        })
        .run()

      expect(legisladorExiste(contexto.db, 'Andrade, Oscar', 'representantes')).not.toBeNull()
      expect(legisladorExiste(contexto.db, 'Andrade, Oscar', 'senado')).toBe(
        contexto.ids.legisladorFaId,
      )
    })
  })
})
