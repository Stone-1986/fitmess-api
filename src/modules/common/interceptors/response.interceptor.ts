import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

export interface ApiResponse<T> {
  success: true;
  statusCode: number;
  data: T;
  meta?: PaginationMeta;
  message?: string;
  timestamp: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const response = context.switchToHttp().getResponse();

    return next.handle().pipe(
      map((data) => ({
        success: true as const,
        statusCode: response.statusCode,
        // Verificacion explicita de presencia de la clave 'data' — NUNCA `??`.
        // `data?.data ?? data` trataba un `data.data` explicitamente `null`
        // como "ausente" (igual que `undefined`) y caia al fallback (el
        // objeto envolvente completo) en vez de preservar el `null`
        // intencional del patron `{ data: null, message }` (soft-delete,
        // ver DELETE /exercises/:id). `'data' in data` distingue "la clave
        // existe con valor null" de "la clave no existe".
        data:
          data && typeof data === 'object' && 'data' in data ? data.data : data, // Soporta { data, meta }, { data: null, message } o data plano
        meta: data?.meta, // Solo si viene paginación
        message: data?.message,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
