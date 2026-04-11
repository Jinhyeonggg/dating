export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'LLM_ERROR'
  | 'FORBIDDEN'
  | 'INTERNAL'

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public status: number,
    public details?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const errors = {
  unauthorized: () => new AppError('UNAUTHORIZED', '인증이 필요합니다', 401),
  notFound: (resource: string) =>
    new AppError('NOT_FOUND', `${resource}를 찾을 수 없습니다`, 404),
  validation: (message: string, details?: unknown) =>
    new AppError('VALIDATION', message, 400, details),
  llm: (cause: Error) =>
    new AppError('LLM_ERROR', 'AI 서비스 오류', 502, { cause: cause.message }),
  forbidden: () => new AppError('FORBIDDEN', '권한이 없습니다', 403),
  internal: () => new AppError('INTERNAL', '서버 오류', 500),
}
