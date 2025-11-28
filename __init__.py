# Neuronal/__init__.py

"""
Inicializador del sistema neuronal de KORBUX IA.
Activa configuración, carga de modelos, servicios de predicción y razonamiento ético.
Incluye trazabilidad evolutiva, manejo resiliente, auditoría semántica y preparación distribuida.
"""

import time
import traceback

from .audit_service import registrar_evento_auditoria
from .config import config
from .health_check import verificar_salud
from .logging_config import configurar_logger
from .model_loader import load_model
from .prediction_service import PredictionService
from .razonamiento import Razonador

# 1️⃣ Configurar logger global con nivel dinámico
logger = configurar_logger(config.environment.get("log_level", "INFO"))

# 2️⃣ Verificar salud del sistema antes de continuar
estado_salud = verificar_salud()
if not estado_salud.get("ok", False):
    logger.warning("[Neuronal] Estado de salud degradado", extra=estado_salud)

# 3️⃣ Medir tiempo de carga del modelo
inicio_carga = time.time()
try:
    modelo = load_model(config.model["default_version"])
    duracion_carga = round(time.time() - inicio_carga, 2)
    logger.info(f"[Neuronal] Modelo cargado: {config.model['default_version']} en {duracion_carga}s")
except Exception as e:
    logger.error("[Neuronal] Error al cargar el modelo", exc_info=True)
    registrar_evento_auditoria(
        tipo="error",
        modulo="model_loader",
        datos={
            "error": str(e),
            "trace": traceback.format_exc(),
            "modelo": config.model["default_version"]
        },
        nivel="sistema"
    )
    modelo = None

# 4️⃣ Inicializar servicio de predicción si el modelo está disponible
if modelo:
    try:
        predictor = PredictionService(modelo, config)
        logger.info("[Neuronal] Servicio de predicción inicializado.")
    except Exception as e:
        predictor = None
        logger.error("[Neuronal] Error al inicializar predictor", exc_info=True)
        registrar_evento_auditoria(
            tipo="error",
            modulo="prediction_service",
            datos={"error": str(e), "trace": traceback.format_exc()},
            nivel="sistema"
        )
else:
    predictor = None
    logger.warning("[Neuronal] Servicio de predicción no disponible.")

# 5️⃣ Inicializar razonador semántico con configuración ética
try:
    razonador = Razonador(config)
    logger.info("[Neuronal] Razonador ético activado.")
except Exception as e:
    razonador = None
    logger.error("[Neuronal] Error al inicializar razonador", exc_info=True)
    registrar_evento_auditoria(
        tipo="error",
        modulo="razonamiento",
        datos={"error": str(e), "trace": traceback.format_exc()},
        nivel="sistema"
    )

# 6️⃣ Registrar evento evolutivo de arranque
registrar_evento_auditoria(
    tipo="sistema",
    modulo="neuronal",
    datos={
        "modelo": config.model["default_version"],
        "entorno": config.env,
        "estado_salud": estado_salud,
        "usuario": config.metadata.get("author", "desconocido"),
        "timestamp": config.environment.get("timestamp"),
        "hostname": config.environment.get("hostname")
    },
    nivel="evolutivo"
)

# 7️⃣ Validar consistencia entre módulos
if predictor and razonador:
    logger.info("[Neuronal] Módulos principales activos y consistentes.")
else:
    logger.warning("[Neuronal] Módulos incompletos. Verifica integridad del sistema.")

# 8️⃣ Preparar contexto compartido para otros módulos
contexto_neuronal = {
    "config": config,
    "logger": logger,
    "predictor": predictor,
    "razonador": razonador,
    "estado_salud": estado_salud
}

# 9️⃣ Exponer interfaces públicas
__all__ = [
    "config",
    "predictor",
    "razonador",
    "registrar_evento_auditoria",
    "logger",
    "contexto_neuronal"
]
