/**
 * @file Middleware de validación para las interacciones de chat.
 * Utiliza express-validator para asegurar que los datos de entrada sean válidos.
 * @module middleware/validacion
 */

const { body, validationResult } = require("express-validator");

/**
 * Middleware para validar la estructura de la interacción del chat (POST /interactuar).
 * Asegura que 'usuarioId' y 'mensajeUsuario' estén presentes y sean cadenas válidas.
 * 'contexto' es opcional y debe ser un objeto si está presente.
 */
const validarInteraccion = [
  // Validación para 'usuarioId'
  body("usuarioId")
    .trim()
    .notEmpty()
    .withMessage("El ID de usuario es obligatorio.")
    .isString()
    .withMessage("El ID de usuario debe ser una cadena de texto."),

  // Validación para 'mensajeUsuario'
  body("mensajeUsuario")
    .trim()
    .notEmpty()
    .withMessage("El mensaje del usuario es obligatorio.")
    .isString()
    .withMessage("El mensaje del usuario debe ser una cadena de texto.")
    .isLength({ min: 1, max: 1000 })
    .withMessage("El mensaje debe tener entre 1 y 1000 caracteres."), // Ejemplo de límite de longitud

  // Validación opcional para 'contexto'
  body("contexto")
    .optional() // Hace que el campo sea opcional
    .isObject()
    .withMessage("El contexto debe ser un objeto.")
    .custom((value) => {
      // Opcional: Validación más profunda del contenido del contexto si es necesario
      // Por ejemplo, si el contexto debe tener ciertas propiedades
      if (value && Object.keys(value).length === 0) {
        throw new Error(
          "El contexto no puede ser un objeto vacío si se proporciona."
        );
      }
      return true;
    }),

  // Middleware para manejar los resultados de la validación
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Si hay errores de validación, se envía una respuesta 400 Bad Request
      return res.status(400).json({
        status: "error",
        code: 400,
        message: "Errores de validación en la solicitud.",
        details: errors.array(), // Devuelve un array con los detalles de cada error
        timestamp: new Date().toISOString(),
      });
    }
    // Si la validación es exitosa, pasa al siguiente middleware o controlador
    next();
  },
];

module.exports = {
  validarInteraccion,
};
