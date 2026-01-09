/**
 * errores.ts
 * Módulo centralizado para manejo de errores en KORBUX IA.
 * Funciona 100% offline, sin dependencias externas.
 */

export class CustomError extends Error {
  public code: number;
  public details?: string;
  public stackTrace?: string;
  public timestamp: string;

  constructor(
    message: string,
    code: number = 500,
    details?: string,
    stackTrace?: string
  ) {
    super(message);
    this.name = "CustomError";
    this.code = code;
    this.details = details;
    this.stackTrace = stackTrace;
    this.timestamp = new Date().toISOString();

    // Mantener el stack original si existe
    if (stackTrace) {
      this.stack = stackTrace;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convierte el error en un objeto JSON estructurado.
   */
  toJSON() {
    return {
      status: "error",
      code: this.code,
      message: this.message,
      details: this.details || null,
      timestamp: this.timestamp,
    };
  }
}

/**
 * Función para manejar errores en middleware de Express.
 * Devuelve una respuesta JSON estructurada.
 */
export function manejarError(err: any, res: any) {
  const statusCode = err.code || 500;

  const respuesta = {
    status: "error",
    code: statusCode,
    message: err.message || "Error interno del servidor",
    details: err.details || null,
    timestamp: new Date().toISOString(),
  };

  // Log offline (puedes extender para guardar en korbux.json)
  console.error("Error capturado:", respuesta);

  return res.status(statusCode).json(respuesta);
}

/**
 * Función auxiliar para crear errores de validación.
 */
export function errorValidacion(campo: string): CustomError {
  return new CustomError(
    `El campo '${campo}' es obligatorio y no puede estar vacío.`,
    400
  );
}

/**
 * Función auxiliar para crear errores de autenticación.
 */
export function errorAutenticacion(detalles?: string): CustomError {
  return new CustomError(
    "Error de autenticación. Acceso denegado.",
    401,
    detalles
  );
}

/**
 * Función auxiliar para crear errores de autorización.
 */
export function errorAutorizacion(detalles?: string): CustomError {
  return new CustomError(
    "Error de autorización. No tienes permisos suficientes.",
    403,
    detalles
  );
}

/**
 * Nueva mejora: función para registrar errores en korbux.json
 * Esto asegura trazabilidad 100% offline.
 */
import fs from "fs";
import path from "path";

const BD_PATH = path.join(__dirname, "korbux.json");

export function registrarErrorOffline(err: CustomError) {
  let bd: any = {};
  try {
    bd = JSON.parse(fs.readFileSync(BD_PATH, "utf8"));
  } catch {
    bd = { errores: [] };
  }

  if (!bd.errores) {
    bd.errores = [];
  }

  bd.errores.push(err.toJSON());

  fs.writeFileSync(BD_PATH, JSON.stringify(bd, null, 2));
}
