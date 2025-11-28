# Neuronal/config.py

import json
import os
import platform
import socket
from datetime import datetime


class Config:
    """
    Configuración centralizada para el sistema neuronal de KORBUX IA.
    Ética, trazabilidad, adaptabilidad cultural y control evolutivo.
    """

    def __init__(self):
        self.base_dir = os.path.abspath(os.path.dirname(__file__))
        self.env = os.getenv("KORBUX_ENV", "development")
        self.timestamp = datetime.utcnow().isoformat()
        self.hostname = socket.gethostname()
        self.system_info = self.get_system_info()

        self.load_environment()
        self.load_localization()
        self.load_model()
        self.load_security()
        self.load_audit()
        self.load_flags()
        self.load_integrations()
        self.load_metadata()

    # 1️⃣ Entorno de ejecución
    def load_environment(self):
        self.environment = {
            "name": self.env,
            "debug": self.env != "production",
            "log_level": "DEBUG" if self.env == "development" else "INFO",
            "data_dir": os.path.join(self.base_dir, "..", "data"),
            "model_dir": os.path.join(self.base_dir, "models"),
            "output_dir": os.path.join(self.base_dir, "..", "output"),
            "temp_dir": os.path.join(self.base_dir, "..", "temp"),
            "hostname": self.hostname,
            "timestamp": self.timestamp
        }

    # 2️⃣ Localización y cultura
    def load_localization(self):
        self.localization = {
            "default_language": "es",
            "supported_languages": [
                "es", "en", "fr", "de", "pt", "zh", "ar", "ru", "ja", "qu", "ay", "nah"
            ],
            "timezone": os.getenv("KORBUX_TIMEZONE", "America/El_Salvador"),
            "culture_profile": os.getenv("KORBUX_CULTURE", "neutral"),
            "date_format": "%Y-%m-%d",
            "time_format": "%H:%M:%S",
            "locale_fallback": "en"
        }

    # 3️⃣ Configuración del modelo neuronal
    def load_model(self):
        self.model = {
            "default_version": "v2",
            "available_versions": ["v1", "v2"],
            "paths": {
                "v1": os.path.join(self.base_dir, "models", "model_v1.pk1"),
                "v2": os.path.join(self.base_dir, "models", "model_v2.h5")
            },
            "max_input_length": 2048,
            "max_output_length": 1024,
            "temperature": float(os.getenv("KORBUX_TEMPERATURE", "0.7")),
            "top_p": float(os.getenv("KORBUX_TOP_P", "0.9")),
            "use_gpu": os.getenv("KORBUX_USE_GPU", "false").lower() == "true",
            "batch_size": int(os.getenv("KORBUX_BATCH_SIZE", "8")),
            "precision": os.getenv("KORBUX_PRECISION", "float32")
        }

    # 4️⃣ Seguridad y límites éticos
    def load_security(self):
        self.security = {
            "enable_audit": True,
            "rate_limit": {
                "enabled": True,
                "requests_per_minute": int(os.getenv("RATE_LIMIT_RPM", "60")),
                "burst_limit": int(os.getenv("RATE_LIMIT_BURST", "100"))
            },
            "token_expiry_minutes": int(os.getenv("TOKEN_EXPIRY", "45")),
            "session_timeout_minutes": int(os.getenv("SESSION_TIMEOUT", "30")),
            "xss_protection": True,
            "content_security_policy": "default-src 'self'; script-src 'self'; object-src 'none'"
        }

    # 5️⃣ Auditoría evolutiva
    def load_audit(self):
        self.audit = {
            "log_path": os.path.join(self.base_dir, "..", "Metadata", "auditoria_global.json"),
            "snapshot_interval_minutes": 15,
            "event_format": "semantic",
            "enable_feedback_loop": True,
            "max_log_size_mb": 10
        }

    # 6️⃣ Flags de ejecución
    def load_flags(self):
        self.flags = {
            "enable_translation": os.getenv("ENABLE_TRANSLATION", "true") == "true",
            "enable_voice": os.getenv("ENABLE_VOICE", "true") == "true",
            "enable_image_generation": os.getenv("ENABLE_IMAGE", "true") == "true",
            "enable_video_generation": os.getenv("ENABLE_VIDEO", "false") == "true",
            "enable_debug_overlay": self.env == "development",
            "enable_metrics": os.getenv("ENABLE_METRICS", "true") == "true"
        }

    # 7️⃣ Integraciones externas
    def load_integrations(self):
        self.integrations = {
            "newrelic": {
                "enabled": os.getenv("NEW_RELIC_ENABLED", "false") == "true",
                "license_key": os.getenv("NEW_RELIC_LICENSE_KEY", "")
            },
            "sentry": {
                "enabled": os.getenv("SENTRY_ENABLED", "false") == "true",
                "dsn": os.getenv("SENTRY_DSN", "")
            },
            "mail": {
                "smtp_host": os.getenv("SMTP_HOST", "smtp.korbux.local"),
                "smtp_port": int(os.getenv("SMTP_PORT", "587")),
                "default_sender": os.getenv("MAIL_SENDER", "noreply@korbux.ai")
            }
        }

    # 8️⃣ Metadatos del sistema
    def load_metadata(self):
        self.metadata = {
            "app_name": os.getenv("KORBUX_APP_NAME", "Korbux IA"),
            "version": os.getenv("KORBUX_VERSION", "1.0.0"),
            "build": os.getenv("KORBUX_BUILD", self.timestamp),
            "author": os.getenv("KORBUX_AUTHOR", "Daniel"),
            "license": os.getenv("KORBUX_LICENSE", "Ethical AI License v1.0")
        }

    # 9️⃣ Información del sistema operativo
    def get_system_info(self):
        return {
            "os": platform.system(),
            "os_version": platform.version(),
            "architecture": platform.machine(),
            "cpu": platform.processor()
        }

    # 🔟 Exportación como diccionario
    def to_dict(self):
        return {
            "environment": self.environment,
            "localization": self.localization,
            "model": self.model,
            "security": self.security,
            "audit": self.audit,
            "flags": self.flags,
            "integrations": self.integrations,
            "metadata": self.metadata,
            "system_info": self.system_info
        }

    # 1️⃣1️⃣ Guardar snapshot evolutivo
    def save_snapshot(self, path="config_snapshot.json"):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=2, ensure_ascii=False)

    # 1️⃣2️⃣ Cargar configuración externa
    def load_from_file(self, path):
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                for key in data:
                    if hasattr(self, key):
                        setattr(self, key, data[key])

# 1️⃣3️⃣ Instancia global
config = Config()
