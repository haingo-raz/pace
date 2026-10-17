export type ApiResult<T> =
  | { ok: true; data: T }
  | {
      ok: false
      error: { code: string; message: string; details?: unknown }
    }

export async function apiFetch<T>(
  url: string,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    })
    const body = (await res.json().catch(() => null)) as unknown
    if (body && typeof body === 'object' && 'ok' in body) {
      return body as ApiResult<T>
    }
    return {
      ok: false,
      error: {
        code: 'INTERNAL',
        message: 'Unexpected response from server.',
      },
    }
  } catch {
    return {
      ok: false,
      error: {
        code: 'NETWORK',
        message: 'Could not reach Pace. Check your connection.',
      },
    }
  }
}
