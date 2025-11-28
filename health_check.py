# Neuronal/health_check.py

import os
import platform
import socket
from datetime import datetime

from .audit_service import registrar_evento_auditoria
from .config import config
from .logging_config import configurar_logger

logger = configurar_logger(config.environment.get("log_level", "INFO"))

def verificar_salud():
    """
    Verifica el estado interno del sistema neuronal de KORBUX IA.
    Evalúa entorno, rutas, sistema operativo, consistencia semántica y preparación evolutiva.
    """

    # 1️⃣ Captura de metadatos semánticos
    estado = {
        "timestamp": datetime.utcnow().isoformat(),
        "hostname": socket.gethostname(),
        "entorno": config.env,
        "version": config.metadata.get("version"),
        "autor": config.metadata.get("author"),
        "idioma": config.localization.get("default_language"),
        "cultura": config.localization.get("culture_profile"),
        "zona_horaria": config.localization.get("timezone"),
        "sistema_operativo": platform.system(),
        "arquitectura": platform.machine(),
        "cpu": platform.processor(),
        "modo_debug": config.environment.get("debug", False),
        "rutas_validas": True,
        "estado": "ok",
        "rutas_faltantes": [],
        "componentes": {},
        "validaciones": []
    }

    # 2️⃣ Validación de rutas críticas
    rutas = {
        "data_dir": config.environment.get("data_dir"),
        "model_dir": config.environment.get("model_dir"),
        "output_dir": config.environment.get("output_dir"),
        "audit_log": config.audit.get("log_path")
    }

    for nombre, ruta in rutas.items():
        if not ruta or not os.path.exists(ruta):
            estado["rutas_validas"] = False
            estado["estado"] = "degradado"
            estado["rutas_faltantes"].append(nombre)
            logger.warning(f"[HealthCheck] Ruta inválida: {nombre} → {ruta}")
            registrar_evento_auditoria("warning", "health_check", {"ruta": ruta, "nombre": nombre}, nivel="sistema")
        else:
            estado["componentes"][nombre] = "ok"

    # 3️⃣ Validación de configuración semántica
    if not config.metadata.get("author"):
        estado["estado"] = "degradado"
        estado["validaciones"].append("Falta autor en metadata")
    if not config.metadata.get("version"):
        estado["estado"] = "degradado"
        estado["validaciones"].append("Falta versión en metadata")

    # 4️⃣ Validación de idioma y cultura
    if config.localization.get("default_language") not in config.localization.get("supported_languages", []):
        estado["estado"] = "degradado"
        estado["validaciones"].append("Idioma no soportado")

    # 5️⃣ Validación de zona horaria
    if not config.localization.get("timezone"):
        estado["estado"] = "degradado"
        estado["validaciones"].append("Zona horaria no definida")

    # 6️⃣ Validación de entorno
    if config.env not in ["development", "production", "staging"]:
        estado["estado"] = "degradado"
        estado["validaciones"].append("Entorno desconocido")

    # 7️⃣ Validación de CPU
    if not estado["cpu"]:
        estado["estado"] = "degradado"
        estado["validaciones"].append("CPU no detectado")

    # 8️⃣ Validación de arquitectura
    if estado["arquitectura"] not in ["x86_64", "arm64"]:
        estado["validaciones"].append("Arquitectura no estándar")

    # 9️⃣ Validación de sistema operativo
    if estado["sistema_operativo"] not in ["Linux", "Windows", "Darwin"]:
        estado["validaciones"].append("Sistema operativo no reconocido")

    # 🔟 Validación de modo debug
    if estado["modo_debug"]:
        estado["validaciones"].append("Modo debug activo")

    # 1️⃣1️⃣ Registro evolutivo del estado
    registrar_evento_auditoria(
        tipo="sistema",
        modulo="health_check",
        datos={"estado": estado["estado"], "validaciones": estado["validaciones"]},
        nivel="info" if estado["estado"] == "ok" else "warning"
    )

    # 1️⃣2️⃣ Preparación para visualización modular
    estado["panel"] = {
        "resumen": {
            "estado": estado["estado"],
            "rutas_validas": estado["rutas_validas"],
            "componentes_ok": len(estado["componentes"]),
            "validaciones": len(estado["validaciones"])
        },
        "detalles": estado["validaciones"]
    }

    # 1️⃣3️⃣ Preparación para exportación
    estado["exportable"] = {
        "timestamp": estado["timestamp"],
        "estado": estado["estado"],
        "componentes": estado["componentes"],
        "validaciones": estado["validaciones"]
    }

    # 1️⃣4️⃣ Preparación para sincronización
    estado["sincronizable"] = {
        "entorno": estado["entorno"],
        "version": estado["version"],
        "autor": estado["autor"],
        "estado": estado["estado"]
    }

    # 1️⃣5️⃣ Preparación para razonamiento
    estado["razonamiento"] = {
        "estado": estado["estado"],
        "fallos": estado["validaciones"],
        "rutas_faltantes": estado["rutas_faltantes"]
    }

    # 1️⃣6️⃣ Preparación para alerta evolutiva
    if estado["estado"] != "ok":
        estado["alerta"] = {
            "nivel": "sistema",
            "mensaje": "Sistema neuronal degradado",
            "timestamp": estado["timestamp"]
        }

    # 1️⃣7️⃣ Preparación para resumen técnico
    estado["resumen_tecnico"] = {
        "os": estado["sistema_operativo"],
        "arch": estado["arquitectura"],
        "cpu": estado["cpu"],
        "debug": estado["modo_debug"]
    }

    # 1️⃣8️⃣ Preparación para exportación cultural
    estado["cultural"] = {
        "idioma": estado["idioma"],
        "cultura": estado["cultura"],
        "zona_horaria": estado["zona_horaria"]
    }

    # 1️⃣9️⃣ Preparación para auditoría externa
    estado["auditable"] = {
        "hostname": estado["hostname"],
        "timestamp": estado["timestamp"],
        "estado": estado["estado"]
    }

    # 2️⃣0️⃣ Retorno final
    return estado
