import { NextFunction, Request, Response, Router } from "express";
import { validarInteraccion } from "../middleware/validacion"; // Middleware de validación
import { registrarInteraccion } from "../services/interaccionService"; // Servicio para registrar interacción
import {
  CustomError,
  errorValidacion,
  manejarError,
  registrarErrorOffline
} from "./errores";
import * as metrics from "./metrics"; // Importar todas las funciones de métricas

const router = Router();

/**
 * @swagger
 * paths:
 *   /api/interaccion:
 *     post:
 *       summary: Registra una interacción de usuario.
 *       description: Recibe el ID de usuario y un mensaje, valida la entrada y registra la interacción en korbux.json.
 *       requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - usuarioId
 *                 - mensajeUsuario
 *               properties:
 *                 usuarioId:
 *                   type: string
 *                   description: Identificador único del usuario.
 *                   example: "user123"
 *                 mensajeUsuario:
 *                   type: string
 *                   description: Mensaje enviado por el usuario.
 *                   example: "¿Cuál es el horario de atención?"
 *       responses:
 *         200:
 *           description: Interacción registrada exitosamente.
 *           content:
 *             application/json:
 *               schema:
 *                 type: object
 *                 properties:
 *                   status:
 *                     type: string
 *                     example: "success"
 *                   data:
 *                     type: object
 *                     description: Resultado de la operación de registro.
 *                   timestamp:
 *                     type: string
 *                     format: date-time
 *                     example: "2025-07-05T18:30:00.000Z"
 *         400:
 *           description: Solicitud inválida debido a falta de usuarioId o mensajeUsuario.
 *           content:
 *             application/json:
 *               schema:
 *                 type: object
 *                 properties:
 *                   status:
 *                     type: string
 *                     example: "error"
 *                   code:
 *                     type: integer
 *                     example: 400
 *                   message:
 *                     type: string
 *                     example: "El campo 'usuarioId' es obligatorio y no puede estar vacío."
 *                   details:
 *                     type: string
 *                     example: "Falta el campo usuarioId en la solicitud."
 *                   timestamp:
 *                     type: string
 *                     format: date-time
 *                     example: "2025-07-05T18:30:00.000Z"
 */
router.post(
  "/interaccion",
  validarInteraccion,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { usuarioId, mensajeUsuario } = req.body as {
        usuarioId?: string;
        mensajeUsuario?: string;
      };

      if (!usuarioId) {
        return res.status(400).json(errorValidacion("usuarioId").toJSON());
      }
      if (!mensajeUsuario) {
        return res.status(400).json(errorValidacion("mensajeUsuario").toJSON());
      }

      // Registrar la interacción en korbux.json (servicio backend)
      const resultado = await registrarInteraccion(usuarioId, mensajeUsuario);

      // Contabilizar métrica de interacción exitosa
      metrics.contar("interaccion_exitosa");

      return res.status(200).json({
        status: "success",
        data: resultado,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      // Contabilizar métrica de error en interacción
      metrics.contar("interaccion_error");
      registrarErrorOffline(err);

      // Manejo centralizado del error
      return manejarError(
        new CustomError(
          "Ocurrió un error al procesar la interacción.",
          500,
          err?.message,
          err?.stack
        ),
        res
      );
    }
  }
);

export default router;
const counters: Record<string, number> = {};

/**
 * Incrementa un contador de métricas por nombre.
 * @param nombre - Nombre de la métrica
 */
export function contar(nombre: string): void {
  if (!counters[nombre]) {
    counters[nombre] = 0;
  }
  counters[nombre]++;
  console.info(`[metrics] ${nombre}: ${counters[nombre]}`);
}

/**
 * Obtiene el valor actual de una métrica.
 * @param nombre - Nombre de la métrica
 */
export function obtener(nombre: string): number {
  return counters[nombre] || 0;
}

/**
 * Devuelve todas las métricas acumuladas.
 */
export function obtenerTodas(): Record<string, number> {
  return { ...counters };
}
