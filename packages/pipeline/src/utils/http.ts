const REINTENTOS_MAXIMO = 3
const TIMEOUT_MS = 30_000
const INTERVALO_MINIMO_MS = 1_000

let ultimaLlamada = 0

async function esperarRateLimit(): Promise<void> {
  const ahora = Date.now()
  const tiempoDesdeUltima = ahora - ultimaLlamada
  if (tiempoDesdeUltima < INTERVALO_MINIMO_MS) {
    await new Promise((resolve) => setTimeout(resolve, INTERVALO_MINIMO_MS - tiempoDesdeUltima))
  }
  ultimaLlamada = Date.now()
}

export async function fetchConReintentos(
  url: string,
  opciones?: RequestInit & { reintentos?: number },
): Promise<Response> {
  const reintentos = opciones?.reintentos ?? REINTENTOS_MAXIMO

  for (let intento = 0; intento <= reintentos; intento++) {
    await esperarRateLimit()

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const respuesta = await fetch(url, {
        ...opciones,
        signal: controller.signal,
      })

      if (!respuesta.ok && intento < reintentos) {
        const espera = Math.pow(2, intento) * 1_000
        await new Promise((resolve) => setTimeout(resolve, espera))
        continue
      }

      return respuesta
    } catch (error) {
      if (intento >= reintentos) {
        throw error
      }
      const espera = Math.pow(2, intento) * 1_000
      await new Promise((resolve) => setTimeout(resolve, espera))
    } finally {
      clearTimeout(timeout)
    }
  }

  throw new Error(`Falló después de ${reintentos} reintentos: ${url}`)
}

/** Resetea el estado del rate limiter (para tests) */
export function _resetearRateLimit(): void {
  ultimaLlamada = 0
}
