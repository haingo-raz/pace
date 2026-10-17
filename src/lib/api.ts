import { NextResponse } from 'next/server'
import { connection } from 'next/server'
import { ZodError } from 'zod'
import { logger } from './logger'

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INSUFFICIENT_POINTS'
  | 'INTERNAL'

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INSUFFICIENT_POINTS: 409,
  INTERNAL: 500,
}

export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: unknown,
  ) {
    super(message)
  }
}

function newRequestId() {
  return 'req_' + Math.random().toString(36).slice(2, 10)
}

export function ok<T extends object>(data: T, requestId: string) {
  return NextResponse.json({ ok: true, data, meta: { requestId } })
}

function errorResponse(
  code: ErrorCode,
  message: string,
  requestId: string,
  details?: unknown,
) {
  return NextResponse.json(
    {
      ok: false,
      error: { code, message, ...(details ? { details } : {}) },
      meta: { requestId },
    },
    { status: STATUS[code] },
  )
}

type Handler<Ctx> = (
  req: Request,
  ctx: Ctx,
  requestId: string,
) => Promise<NextResponse>

export function withRoute<Ctx>(name: string, handler: Handler<Ctx>) {
  return async (req: Request, ctx: Ctx) => {
    await connection()
    const requestId = newRequestId()
    const started = Date.now()
    try {
      const res = await handler(req, ctx, requestId)
      logger.info({
        requestId,
        route: name,
        status: res.status,
        ms: Date.now() - started,
      })
      return res
    } catch (e) {
      const ms = Date.now() - started
      if (e instanceof ZodError) {
        logger.warn({
          requestId,
          route: name,
          code: 'VALIDATION_ERROR',
          ms,
        })
        return errorResponse(
          'VALIDATION_ERROR',
          'Please check the highlighted fields.',
          requestId,
          { issues: e.issues },
        )
      }
      if (e instanceof ApiError) {
        logger.warn({ requestId, route: name, code: e.code, ms })
        return errorResponse(e.code, e.message, requestId, e.details)
      }
      logger.error({
        requestId,
        route: name,
        ms,
        message: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      })
      return errorResponse(
        'INTERNAL',
        'Something went wrong on our end. Try again.',
        requestId,
      )
    }
  }
}
