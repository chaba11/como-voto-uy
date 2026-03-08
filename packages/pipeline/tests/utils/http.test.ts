import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { _resetearRateLimit, fetchConReintentos } from '../../src/utils/http.js'

describe('fetchConReintentos', () => {
  beforeEach(() => {
    _resetearRateLimit()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('retorna la respuesta si la primera llamada tiene éxito', async () => {
    const mockResponse = new Response('ok', { status: 200 })
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse)

    const resultado = await fetchConReintentos('https://ejemplo.com', { reintentos: 0 })

    expect(resultado.status).toBe(200)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('reintenta en caso de error de red', async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))

    const resultado = await fetchConReintentos('https://ejemplo.com', { reintentos: 1 })

    expect(resultado.status).toBe(200)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('reintenta en caso de respuesta no-ok', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response('error', { status: 500 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))

    const resultado = await fetchConReintentos('https://ejemplo.com', { reintentos: 1 })

    expect(resultado.status).toBe(200)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('lanza error después de agotar reintentos', async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))

    await expect(
      fetchConReintentos('https://ejemplo.com', { reintentos: 1 }),
    ).rejects.toThrow('Network error')
  })

  it('respeta el rate limiting entre llamadas', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response('ok1', { status: 200 }))
      .mockResolvedValueOnce(new Response('ok2', { status: 200 }))

    const inicio = Date.now()

    await fetchConReintentos('https://ejemplo.com/1', { reintentos: 0 })
    await fetchConReintentos('https://ejemplo.com/2', { reintentos: 0 })

    const duracion = Date.now() - inicio

    // La segunda llamada debe esperar al menos ~1 segundo por rate limiting
    expect(duracion).toBeGreaterThanOrEqual(900)
  })
})
