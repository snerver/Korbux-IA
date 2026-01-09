// routes/web.js

/**
 * @file Rutas para las páginas web de la aplicación.
 * @description Define los endpoints para servir las páginas HTML principales,
 * como la página de inicio, acerca de, contacto, etc. Estas rutas generalmente
 * no requieren autenticación API basada en tokens.
 * @module routes/web
 */

const express = require("express");
const router = express.Router();
const path = require("path");

const logger = require(path.join(__dirname, "..", "config", "logger.js")); // Importa tu logger
const { Errores } = require(path.join(__dirname, "..", "utils", "errores.js")); // Importa tus clases de errores personalizados

// NOTA IMPORTANTE:
// Este router se montará en `app.js` (o `server.js`) generalmente en la raíz (`/`).
// Por ejemplo: `app.use('/', webRoutes);`
// Las rutas aquí definidas serán accesibles directamente (ej. `/`, `/about`, `/contact`).

/**
 * @swagger
 * /:
 * get:
 * summary: Página de inicio.
 * description: Sirve la página de inicio de la aplicación web.
 * responses:
 * 200:
 * description: HTML de la página de inicio.
 * content:
 * text/html:
 * schema:
 * type: string
 * example: "<h1>Bienvenido a Korbux!</h1>"
 * 500:
 * description: Error interno del servidor.
 */
router.get("/", (req, res, next) => {
  logger.debug("[Web Routes] Solicitud GET / (página de inicio).");
  try {
    // En una aplicación real, aquí usarías un motor de plantillas como EJS, Pug o Handlebars:
    // res.render('index', { title: 'Bienvenido a Korbux' });
    res.status(200).send(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Korbux - Inicio</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; background-color: #f4f4f4; color: #333; }
                    .container { max-width: 800px; margin: auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                    h1 { color: #0056b3; }
                    nav a { margin-right: 15px; text-decoration: none; color: #0056b3; }
                    nav a:hover { text-decoration: underline; }
                </style>
            </head>
            <body>
                <div class="container">
                    <nav>
                        <a href="/">Inicio</a>
                        <a href="/about">Acerca de</a>
                        <a href="/contact">Contacto</a>
                        <a href="/dashboard">Dashboard</a>
                        <a href="/login">Iniciar Sesión</a>
                    </nav>
                    <h1>Bienvenido a Korbux!</h1>
                    <p>Tu plataforma de chat inteligente y mucho más.</p>
                    <p>Explora nuestras funcionalidades y descubre cómo podemos ayudarte.</p>
                </div>
            </body>
            </html>
        `);
  } catch (err) {
    logger.error(" [Web Routes] Error al servir la página de inicio:", err);
    next(err); // Pasar el error al middleware de manejo de errores.
  }
});

/**
 * @swagger
 * /about:
 * get:
 * summary: Página "Acerca de".
 * description: Sirve la página con información sobre la aplicación.
 * responses:
 * 200:
 * description: HTML de la página "Acerca de".
 * 500:
 * description: Error interno del servidor.
 */
router.get("/about", (req, res, next) => {
  logger.debug("[Web Routes] Solicitud GET /about.");
  try {
    // res.render('about', { title: 'Acerca de Korbux' });
    res.status(200).send(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Korbux - Acerca de</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; background-color: #f4f4f4; color: #333; }
                    .container { max-width: 800px; margin: auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                    h1 { color: #0056b3; }
                    nav a { margin-right: 15px; text-decoration: none; color: #0056b3; }
                    nav a:hover { text-decoration: underline; }
                </style>
            </head>
            <body>
                <div class="container">
                    <nav>
                        <a href="/">Inicio</a>
                        <a href="/about">Acerca de</a>
                        <a href="/contact">Contacto</a>
                        <a href="/dashboard">Dashboard</a>
                        <a href="/login">Iniciar Sesión</a>
                    </nav>
                    <h1>Acerca de Korbux</h1>
                    <p>Korbux es una solución innovadora diseñada para simplificar tus interacciones diarias.</p>
                    <p>Nos dedicamos a proporcionar herramientas eficientes y una experiencia de usuario fluida.</p>
                    <p>¡Gracias por ser parte de nuestra comunidad!</p>
                </div>
            </body>
            </html>
        `);
  } catch (err) {
    logger.error(' [Web Routes] Error al servir la página "Acerca de":', err);
    next(err);
  }
});

/**
 * @swagger
 * /contact:
 * get:
 * summary: Página de contacto.
 * description: Sirve la página con información de contacto.
 * responses:
 * 200:
 * description: HTML de la página de contacto.
 * 500:
 * description: Error interno del servidor.
 */
router.get("/contact", (req, res, next) => {
  logger.debug("[Web Routes] Solicitud GET /contact.");
  try {
    // res.render('contact', { title: 'Contacto Korbux' });
    res.status(200).send(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Korbux - Contacto</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; background-color: #f4f4f4; color: #333; }
                    .container { max-width: 800px; margin: auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                    h1 { color: #0056b3; }
                    nav a { margin-right: 15px; text-decoration: none; color: #0056b3; }
                    nav a:hover { text-decoration: underline; }
                </style>
            </head>
            <body>
                <div class="container">
                    <nav>
                        <a href="/">Inicio</a>
                        <a href="/about">Acerca de</a>
                        <a href="/contact">Contacto</a>
                        <a href="/dashboard">Dashboard</a>
                        <a href="/login">Iniciar Sesión</a>
                    </nav>
                    <h1>Contáctanos</h1>
                    <p>Si tienes alguna pregunta o sugerencia, no dudes en contactarnos.</p>
                    <p>Email: <a href="mailto:info@korbux.com">info@korbux.com</a></p>
                    <p>Teléfono: +123 456 7890</p>
                    <p>Dirección: Calle Falsa 123, Ciudad Ficticia, País Imaginario</p>
                </div>
            </body>
            </html>
        `);
  } catch (err) {
    logger.error(" [Web Routes] Error al servir la página de contacto:", err);
    next(err);
  }
});

/**
 * @swagger
 * /dashboard:
 * get:
 * summary: Página del dashboard de usuario.
 * description: Sirve la página principal del dashboard para usuarios autenticados.
 * Esta ruta podría requerir autenticación en un entorno real.
 * responses:
 * 200:
 * description: HTML de la página del dashboard.
 * 500:
 * description: Error interno del servidor.
 */
router.get("/dashboard", (req, res, next) => {
  logger.debug("[Web Routes] Solicitud GET /dashboard.");
  try {
    // En una aplicación real, esta ruta podría requerir un middleware de autenticación
    // para verificar si el usuario ha iniciado sesión antes de renderizar el dashboard.
    // if (!req.user) { // Suponiendo que req.user es establecido por un middleware de autenticación
    //     return res.redirect('/login'); // Redirigir a la página de inicio de sesión
    // }
    // res.render('dashboard', { user: req.user });
    res.status(200).send(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Korbux - Dashboard</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; background-color: #f4f4f4; color: #333; }
                    .container { max-width: 800px; margin: auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                    h1 { color: #0056b3; }
                    nav a { margin-right: 15px; text-decoration: none; color: #0056b3; }
                    nav a:hover { text-decoration: underline; }
                </style>
            </head>
            <body>
                <div class="container">
                    <nav>
                        <a href="/">Inicio</a>
                        <a href="/about">Acerca de</a>
                        <a href="/contact">Contacto</a>
                        <a href="/dashboard">Dashboard</a>
                        <a href="/login">Iniciar Sesión</a>
                    </nav>
                    <h1>Tu Dashboard</h1>
                    <p>Bienvenido a tu panel de control personal. Aquí puedes gestionar tu cuenta y acceder a tus herramientas.</p>
                    <p>¡Pronto habrá más funciones disponibles!</p>
                </div>
            </body>
            </html>
        `);
  } catch (err) {
    logger.error(
      " [Web Routes] Error al servir la página del dashboard:",
      err
    );
    next(err);
  }
});

/**
 * @swagger
 * /login:
 * get:
 * summary: Página de inicio de sesión.
 * description: Sirve la página de inicio de sesión para que los usuarios puedan autenticarse.
 * responses:
 * 200:
 * description: HTML de la página de inicio de sesión.
 * 500:
 * description: Error interno del servidor.
 */
router.get("/login", (req, res, next) => {
  logger.debug("[Web Routes] Solicitud GET /login.");
  try {
    // res.render('login', { title: 'Iniciar Sesión' });
    res.status(200).send(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Korbux - Iniciar Sesión</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; background-color: #f4f4f4; color: #333; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                    .login-container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); width: 100%; max-width: 400px; text-align: center; }
                    h1 { color: #0056b3; margin-bottom: 20px; }
                    form { display: flex; flex-direction: column; gap: 15px; }
                    input[type="email"], input[type="password"] { padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 16px; }
                    button { padding: 10px 20px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; transition: background-color 0.3s ease; }
                    button:hover { background-color: #0056b3; }
                    .links { margin-top: 15px; }
                    .links a { color: #0056b3; text-decoration: none; margin: 0 10px; }
                    .links a:hover { text-decoration: underline; }
                </style>
            </head>
            <body>
                <div class="login-container">
                    <h1>Iniciar Sesión</h1>
                    <form action="/api/auth/login" method="POST">
                        <input type="email" name="email" placeholder="Correo electrónico" required>
                        <input type="password" name="password" placeholder="Contraseña" required>
                        <button type="submit">Iniciar Sesión</button>
                    </form>
                    <div class="links">
                        <a href="/register">Registrarse</a>
                        <a href="/forgot-password">Olvidé mi contraseña</a>
                    </div>
                </div>
            </body>
            </html>
        `);
  } catch (err) {
    logger.error(
      " [Web Routes] Error al servir la página de inicio de sesión:",
      err
    );
    next(err);
  }
});

/**
 * @swagger
 * /register:
 * get:
 * summary: Página de registro.
 * description: Sirve la página de registro para que los nuevos usuarios puedan crear una cuenta.
 * responses:
 * 200:
 * description: HTML de la página de registro.
 * 500:
 * description: Error interno del servidor.
 */
router.get("/register", (req, res, next) => {
  logger.debug("[Web Routes] Solicitud GET /register.");
  try {
    res.status(200).send(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Korbux - Registrarse</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; background-color: #f4f4f4; color: #333; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                    .register-container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); width: 100%; max-width: 400px; text-align: center; }
                    h1 { color: #0056b3; margin-bottom: 20px; }
                    form { display: flex; flex-direction: column; gap: 15px; }
                    input[type="text"], input[type="email"], input[type="password"] { padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 16px; }
                    button { padding: 10px 20px; background-color: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; transition: background-color 0.3s ease; }
                    button:hover { background-color: #218838; }
                    .links { margin-top: 15px; }
                    .links a { color: #0056b3; text-decoration: none; margin: 0 10px; }
                    .links a:hover { text-decoration: underline; }
                </style>
            </head>
            <body>
                <div class="register-container">
                    <h1>Registrarse</h1>
                    <form action="/api/auth/register" method="POST">
                        <input type="text" name="username" placeholder="Nombre de usuario" required>
                        <input type="email" name="email" placeholder="Correo electrónico" required>
                        <input type="password" name="password" placeholder="Contraseña" required>
                        <button type="submit">Registrarse</button>
                    </form>
                    <div class="links">
                        <a href="/login">¿Ya tienes cuenta? Inicia sesión</a>
                    </div>
                </div>
            </body>
            </html>
        `);
  } catch (err) {
    logger.error(" [Web Routes] Error al servir la página de registro:", err);
    next(err);
  }
});

/**
 * @swagger
 * /forgot-password:
 * get:
 * summary: Página de "Olvidé mi contraseña".
 * description: Sirve la página para solicitar un restablecimiento de contraseña.
 * responses:
 * 200:
 * description: HTML de la página de "Olvidé mi contraseña".
 * 500:
 * description: Error interno del servidor.
 */
router.get("/forgot-password", (req, res, next) => {
  logger.debug("[Web Routes] Solicitud GET /forgot-password.");
  try {
    res.status(200).send(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Korbux - Olvidé mi Contraseña</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; background-color: #f4f4f4; color: #333; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                    .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); width: 100%; max-width: 400px; text-align: center; }
                    h1 { color: #0056b3; margin-bottom: 20px; }
                    form { display: flex; flex-direction: column; gap: 15px; }
                    input[type="email"] { padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 16px; }
                    button { padding: 10px 20px; background-color: #ffc107; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; transition: background-color 0.3s ease; }
                    button:hover { background-color: #e0a800; }
                    .links { margin-top: 15px; }
                    .links a { color: #0056b3; text-decoration: none; margin: 0 10px; }
                    .links a:hover { text-decoration: underline; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Olvidé mi Contraseña</h1>
                    <p>Introduce tu correo electrónico para restablecer tu contraseña.</p>
                    <form action="/api/auth/request-password-reset" method="POST">
                        <input type="email" name="email" placeholder="Correo electrónico" required>
                        <button type="submit">Enviar Enlace de Restablecimiento</button>
                    </form>
                    <div class="links">
                        <a href="/login">Volver a Iniciar Sesión</a>
                    </div>
                </div>
            </body>
            </html>
        `);
  } catch (err) {
    logger.error(
      ' [Web Routes] Error al servir la página de "Olvidé mi contraseña":',
      err
    );
    next(err);
  }
});

// ---------------------------------------------------
//  Ruta Catch-all para 404 en rutas web
// Este middleware DEBE ser el ÚLTIMO en este archivo de rutas.
// Si una solicitud llega a este router pero no coincide con ninguna de las rutas
// definidas anteriormente, se considera un 404 (Not Found) para las rutas web.
// ---------------------------------------------------
router.use((req, res, next) => {
  logger.warn(
    ` [Web Routes] Ruta web no encontrada: ${req.method} ${req.originalUrl}`
  );
  // Puedes renderizar una página 404 personalizada:
  // res.status(404).render('404', { title: 'Página no encontrada' });
  res.status(404).send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>404 - Página no encontrada</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; background-color: #f8d7da; color: #721c24; text-align: center; }
                .container { max-width: 600px; margin: auto; background: #fdfdfe; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border: 1px solid #f5c6cb; }
                h1 { color: #dc3545; }
                a { color: #0056b3; text-decoration: none; }
                a:hover { text-decoration: underline; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Error 404 - Página no encontrada</h1>
                <p>Lo sentimos, la página que estás buscando no existe.</p>
                <p><a href="/">Volver a la página de inicio</a></p>
            </div>
        </body>
        </html>
    `);
});

//  Exportación del router para que pueda ser utilizado por 'app.js' (o 'server.js').
module.exports = router;
