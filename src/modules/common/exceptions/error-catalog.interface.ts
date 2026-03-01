export interface ErrorCatalogEntry {
  code: string; // UPPER_SNAKE_CASE — identificador máquina
  title: string; // Mensaje estable — NO cambia entre ocurrencias
  httpStatus: number; // HTTP status code por defecto
}
