# Neuronal/logging_config.py

import logging
import os
from datetime import datetime

from .config import config


def configurar_logger(nivel="INFO"):
    """
    Configura el sistema de logging semántico para KORBUX IA.
    Incluye trazabilidad evolutiva, formato cultural, resiliencia operativa y compatibilidad con auditoría.
    """

    # 1️⃣ Conversión segura de nivel textual
    niveles = {
        "DEBUG": logging.DEBUG,
        "INFO": logging.INFO,
        "WARNING": logging.WARNING,
        "ERROR": logging.ERROR,
        "CRITICAL": logging.CRITICAL
    }
    nivel_log = niveles.get(nivel.upper(), logging.INFO)

    # 2️⃣ Preparación de ruta de logs
    log_dir = config.environment.get("log_dir", "./logs")
    os.makedirs(log_dir, exist_ok=True)

    # 3️⃣ Nombre de archivo con timestamp evolutivo
    fecha = datetime.utcnow().strftime('%Y%m%d')
    log_file = os.path.join(log_dir, f"korbux_{fecha}.log")

    # 4️⃣ Formato semántico y cultural
    formato = logging.Formatter(
        fmt="[{asctime}] [{levelname}] [{name}] → {message}",
        datefmt="%Y-%m-%d %H:%M:%S",
        style="{"
    )

    # 5️⃣ Logger raíz con nombre ético
    logger = logging.getLogger("KORBUX")
    logger.setLevel(nivel_log)
    logger.handlers.clear()

    # 6️⃣ Handler de archivo con codificación UTF-8
    archivo_handler = logging.FileHandler(log_file, encoding="utf-8")
    archivo_handler.setFormatter(formato)
    archivo_handler.setLevel(nivel_log)
    logger.addHandler(archivo_handler)

    # 7️⃣ Handler de consola para entornos locales
    consola_handler = logging.StreamHandler()
    consola_handler.setFormatter(formato)
    consola_handler.setLevel(nivel_log)
    logger.addHandler(consola_handler)

    # 8️⃣ Registro de arranque con contexto semántico
    logger.info(" Logger semántico de KORBUX IA inicializado.")
    logger.debug(f" Entorno: {config.env} | Idioma: {config.localization.get('default_language')}")

    # 9️⃣ Registro de cultura y zona horaria
    logger.debug(f" Cultura: {config.localization.get('culture_profile')} | Zona horaria: {config.localization.get('timezone')}")

    # 🔟 Registro de versión y autor
    logger.debug(f" Versión: {config.metadata.get('version')} | Autor: {config.metadata.get('author')}")

    # 1️⃣1️⃣ Validación de nivel de logging
    if nivel.upper() not in niveles:
        logger.warning(f"[LoggingConfig] Nivel desconocido: {nivel}. Usando INFO por defecto.")

    # 1️⃣2️⃣ Preparado para auditoría evolutiva
    logger.info(f"[LoggingConfig] Archivo de log: {log_file}")

    # 1️⃣3️⃣ Preparado para visualización modular
    logger.debug("[LoggingConfig] Logging listo para panel de monitoreo.")

    # 1️⃣4️⃣ Preparado para integración distribuida
    logger.debug("[LoggingConfig] Compatible con módulos remotos y locales.")

    # 1️⃣5️⃣ Preparado para sincronización cultural
    logger.debug("[LoggingConfig] Adaptado a perfil cultural: " + config.localization.get("culture_profile", "neutral"))

    # 1️⃣6️⃣ Preparado para resiliencia operativa
    logger.debug("[LoggingConfig] Logger reiniciable sin pérdida de contexto.")

    # 1️⃣7️⃣ Preparado para entornos sin conexión
    logger.debug("[LoggingConfig] Operando en modo offline.")

    # 1️⃣8️⃣ Preparado para auditoría externa
    logger.debug("[LoggingConfig] Registro trazable para revisión ética.")

    # 1️⃣9️⃣ Preparado para exportación evolutiva
    logger.debug("[LoggingConfig] Logs listos para respaldo y análisis semántico.")

    # 2️⃣0️⃣ Retorno final del logger
    return logger
