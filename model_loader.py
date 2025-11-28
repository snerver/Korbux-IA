# Neuronal/model_loader.py

import json
import os
import traceback
from datetime import datetime

from .audit_service import registrar_evento_auditoria
from .config import config
from .logging_config import configurar_logger

logger = configurar_logger(config.environment.get("log_level", "INFO"))

def load_model(version="default"):
    """
    Carga un modelo neuronal local según la versión especificada.
    Verifica existencia, integridad, contexto semántico y preparación evolutiva.
    """

    # 1️⃣ Preparar ruta del modelo
    model_dir = config.environment.get("model_dir", "./modelos")
    os.makedirs(model_dir, exist_ok=True)  # 2️⃣ Asegurar existencia del directorio
    model_path = os.path.join(model_dir, f"{version}.json")

    # 3️⃣ Verificar existencia del archivo
    if not os.path.exists(model_path):
        logger.error(f"[ModelLoader] Modelo no encontrado: {model_path}")
        registrar_evento_auditoria(
            tipo="error",
            modulo="model_loader",
            datos={
                "version": version,
                "error": "Archivo no encontrado",
                "ruta": model_path,
                "timestamp": datetime.utcnow().isoformat()
            },
            nivel="sistema"
        )
        raise FileNotFoundError(f"Modelo {version} no disponible en {model_path}")

    try:
        # 4️⃣ Cargar contenido del modelo
        with open(model_path, "r", encoding="utf-8") as f:
            modelo = json.load(f)

        # 5️⃣ Validar estructura mínima
        campos_requeridos = ["nombre", "estructura"]
        faltantes = [c for c in campos_requeridos if c not in modelo]
        if faltantes:
            raise ValueError(f"Modelo incompleto. Faltan campos: {faltantes}")

        # 6️⃣ Validar tipo de estructura
        if not isinstance(modelo["estructura"], dict):
            raise TypeError("La estructura del modelo debe ser un diccionario")

        # 7️⃣ Validar nombre semántico
        if not isinstance(modelo["nombre"], str) or len(modelo["nombre"].strip()) < 3:
            raise ValueError("Nombre del modelo inválido o demasiado corto")

        # 8️⃣ Validar versión contra metadata
        if version != config.metadata.get("version") and version != "default":
            logger.warning(f"[ModelLoader] Versión solicitada ({version}) difiere de la versión activa ({config.metadata.get('version')})")

        # 9️⃣ Registrar evento evolutivo
        registrar_evento_auditoria(
            tipo="sistema",
            modulo="model_loader",
            datos={
                "version": version,
                "modelo": modelo.get("nombre"),
                "estructura": list(modelo.get("estructura", {}).keys()),
                "autor": config.metadata.get("author"),
                "timestamp": datetime.utcnow().isoformat()
            },
            nivel="evolutivo"
        )

        # 🔟 Registro técnico
        logger.info(f"[ModelLoader] Modelo cargado: {modelo.get('nombre')} ({version})")
        logger.debug(f"[ModelLoader] Estructura: {list(modelo['estructura'].keys())}")

        # 1️⃣1️⃣ Preparado para razonamiento
        modelo["contexto"] = {
            "version": version,
            "autor": config.metadata.get("author"),
            "idioma": config.localization.get("default_language"),
            "cultura": config.localization.get("culture_profile"),
            "zona_horaria": config.localization.get("timezone")
        }

        # 1️⃣2️⃣ Preparado para visualización
        modelo["panel"] = {
            "nombre": modelo["nombre"],
            "campos": list(modelo["estructura"].keys()),
            "version": version
        }

        # 1️⃣3️⃣ Preparado para auditoría externa
        modelo["auditable"] = {
            "ruta": model_path,
            "timestamp": datetime.utcnow().isoformat()
        }

        # 1️⃣4️⃣ Preparado para sincronización
        modelo["sincronizable"] = {
            "modelo": modelo["nombre"],
            "estructura": modelo["estructura"],
            "version": version
        }

        # 1️⃣5️⃣ Preparado para exportación evolutiva
        modelo["exportable"] = {
            "nombre": modelo["nombre"],
            "estructura": modelo["estructura"]
        }

        # 1️⃣6️⃣ Validación de tamaño
        if os.path.getsize(model_path) > 5 * 1024 * 1024:
            logger.warning("[ModelLoader] Modelo excede tamaño recomendado (>5MB)")

        # 1️⃣7️⃣ Validación de campos vacíos
        campos_vacios = [k for k, v in modelo["estructura"].items() if v in [None, "", []]]
        if campos_vacios:
            logger.warning(f"[ModelLoader] Campos vacíos detectados: {campos_vacios}")

        # 1️⃣8️⃣ Registro de cultura y entorno
        logger.debug(f"[ModelLoader] Cultura: {config.localization.get('culture_profile')} | Entorno: {config.env}")

        # 1️⃣9️⃣ Registro de zona horaria y idioma
        logger.debug(f"[ModelLoader] Zona horaria: {config.localization.get('timezone')} | Idioma: {config.localization.get('default_language')}")

        # 2️⃣0️⃣ Retorno final del modelo
        return modelo

    except Exception as e:
        logger.error("[ModelLoader] Error al cargar modelo", exc_info=True)
        registrar_evento_auditoria(
            tipo="error",
            modulo="model_loader",
            datos={
                "version": version,
                "error": str(e),
                "trace": traceback.format_exc(),
                "ruta": model_path,
                "timestamp": datetime.utcnow().isoformat()
            },
            nivel="sistema"
        )
        raise e
