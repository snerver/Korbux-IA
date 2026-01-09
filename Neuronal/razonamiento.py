import logging
import asyncio
import json
from datetime import datetime
from typing import Optional, Dict, Any

# --- Configuración del Logger ---
# Es buena práctica que cada módulo configure su propio logger.
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO) # Nivel de log por defecto para este módulo

# Si no hay un manejador de logs global configurado, añade uno básico para consola.
# Esto asegura que los logs de este módulo sean visibles incluso en entornos simples.
if not logger.handlers:
    console_handler = logging.StreamHandler()
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

class ReasoningEngine:
    """
    Clase que encapsula la lógica principal de razonamiento o procesamiento de la aplicación.
    Puede actuar como la interfaz con modelos de IA, motores de reglas o lógica de decisión compleja.
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Inicializa el motor de razonamiento.

        Args:
            config: Un diccionario de configuración opcional.
                    Ejemplo: {'model_name': 'gpt-3.5-turbo', 'api_key': 'YOUR_API_KEY'}.
                    Si no se proporciona, se usa un diccionario vacío por defecto.
        """
        self.config = config if config is not None else {}
        self.model_name: str = self.config.get('model_name', 'DefaultReasoningModel')

        # Aquí podrías inicializar clientes de API para modelos de IA reales si los necesitaras.
        # Por ejemplo:
        # from openai import OpenAI
        # self.ai_client = OpenAI(api_key=self.config.get('api_key'))

        logger.info(f"ReasoningEngine inicializado para usar el modelo: {self.model_name}")

    async def process_user_input(self, user_id: str, message_text: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Procesa una entrada de usuario, aplicando la lógica de razonamiento para generar una respuesta
        o determinar una acción. Este método es asíncrono, ideal para interacciones con APIs externas (ej. LLMs).

        Args:
            user_id: El ID único del usuario que envía el mensaje.
            message_text: El texto del mensaje recibido del usuario.
            context: Un diccionario opcional que contiene información adicional relevante
                     (ej. historial de conversación, preferencias del usuario).

        Returns:
            Un diccionario con el resultado del procesamiento, incluyendo la respuesta generada,
            si se requiere una acción, y cualquier dato asociado a esa acción.
        """
        # Validar entradas básicas para evitar procesar mensajes vacíos o sin ID de usuario.
        if not user_id or not message_text or message_text.strip() == "":
            logger.warning(f"Entrada inválida detectada. user_id: '{user_id}', message_text: '{message_text}'")
            return {
                "error": "El ID de usuario o el mensaje son inválidos/vacíos. Por favor, proporcione una entrada válida.",
                "timestamp": datetime.now().isoformat()
            }

        processed_message: str = message_text.strip()
        logger.info(f"[{user_id}] Procesando mensaje de entrada: '{processed_message[:100]}...'")

        response_text: str = ""
        action_required: bool = False
        action_data: Dict[str, Any] = {}

        # Convertir el mensaje a minúsculas una sola vez para comparaciones sensibles a mayúsculas/minúsculas.
        lower_message = processed_message.lower()

        # --- Lógica de Razonamiento de Ejemplo (simulada) ---
        # Esta sección debe ser reemplazada con tu lógica de IA real, procesamiento de lenguaje natural (NLP),
        # motor de reglas, o integración con servicios externos.

        if "hola" in lower_message or "saludos" in lower_message:
            response_text = "¡Hola! ¿En qué puedo ayudarte hoy?"
        elif "gracias" in lower_message:
            response_text = "De nada. Estoy aquí para servirte."
        elif "hora" in lower_message:
            response_text = f"La hora actual es: {datetime.now().strftime('%H:%M:%S')}."
        elif "calcular" in lower_message:
            # Ejemplo simple de una acción requerida basada en el contenido del mensaje.
            action_required = True
            action_data = {"type": "cálculo", "consulta": processed_message}
            response_text = "Entendido, estoy procesando tu solicitud de cálculo."
        elif "contexto" in lower_message and context:
            # Intenta serializar el contexto a JSON para una visualización legible.
            try:
                context_str = json.dumps(context, indent=2, ensure_ascii=False)
                response_text = f"Aquí está el contexto que tengo: \n```json\n{context_str}\n```"
            except TypeError:
                # Captura errores si el contexto no es serializable a JSON.
                logger.error(f"Error: El objeto de contexto para el usuario {user_id} no es serializable a JSON: {context}")
                response_text = "Hubo un problema al mostrar el contexto. Parece que contiene datos que no puedo procesar."
        else:
            # Si no hay coincidencias con palabras clave, simula una llamada a un modelo de IA externo.
            # Para integrar un modelo de IA real, descomenta la siguiente línea y reemplaza `_call_ai_model`.
            # try:
            #     ai_response = await self._call_ai_model(processed_message, context)
            #     response_text = ai_response.get("model_response", "No pude generar una respuesta en este momento.")
            # except Exception as e:
            #     logger.error(f"Error al llamar al modelo AI para user {user_id}: {e}")
            #     response_text = "Lo siento, tuve un problema al comunicarme con mi cerebro. Por favor, inténtalo de nuevo más tarde."
            response_text = f"Recibí tu mensaje: '{processed_message}'. Estoy pensando en cómo responder..."

        logger.info(f"[{user_id}] Respuesta final generada: '{response_text[:100]}...'")

        return {
            "processed_input": processed_message,
            "response": response_text,
            "action_required": action_required,
            "action_data": action_data,
            "timestamp": datetime.now().isoformat(),
            "model_used": self.model_name
        }

    async def _call_ai_model(self, prompt: str, conversation_history: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Método de ejemplo para simular la interacción con un modelo de IA externo (ej. un LLM).
        Este método debería ser reemplazado por la lógica de llamada a la API real de tu modelo de IA.

        Args:
            prompt: El texto de entrada principal (pregunta o instrucción) para el modelo de IA.
            conversation_history: Un diccionario opcional que contiene el historial de la conversación,
                                  esencial para que el LLM mantenga el contexto.

        Returns:
            Un diccionario con la respuesta del modelo de IA.
        """
        logger.info(f"Simulando llamada a modelo AI '{self.model_name}' con prompt: '{prompt[:100]}...'")

        # Simula una latencia de red o tiempo de procesamiento del modelo.
        await asyncio.sleep(0.5)

        # --- LÓGICA DE LLAMADA A LA API REAL DEL MODELO DE IA ---
        # Aquí es donde integrarías el cliente de tu LLM (ej. `self.ai_client.chat.completions.create(...)`).
        # Ejemplo conceptual:
        # try:
        #     response = await self.ai_client.chat.completions.create(
        #         model=self.model_name,
        #         messages=[
        #             {"role": "system", "content": "Eres un asistente virtual útil y conciso."},
        #             # Asegúrate de formatear 'conversation_history' de acuerdo a la API del LLM.
        #             # Por ejemplo, puedes iterar sobre el historial y añadir mensajes de "user" y "assistant".
        #             {"role": "user", "content": prompt}
        #         ],
        #         temperature=0.7 # Opciones para controlar la creatividad del modelo
        #     )
        #     model_response_content = response.choices[0].message.content
        #     logger.debug(f"Respuesta real del modelo AI: {model_response_content[:100]}...")
        #     return {"model_response": model_response_content}
        # except Exception as e:
        #     logger.error(f"Error al intentar llamar al modelo AI '{self.model_name}': {e}")
        #     # Retorna una respuesta de error para que el llamador pueda manejarla.
        #     return {"model_response": "Error: No se pudo obtener una respuesta del modelo de IA."}

        logger.debug("Respuesta del modelo AI simulada completada.")
        return {"model_response": "Esta es una respuesta simulada de la Inteligencia Artificial."}

# --- Ejemplo de Uso Directo (para pruebas del módulo) ---
if __name__ == "__main__":
    async def main_test_suite():
        """
        Función principal para ejecutar una serie de pruebas del ReasoningEngine.
        """
        engine = ReasoningEngine(config={'model_name': 'Korbux-LLM-v1'})

        print("\n--- Test 1: Mensaje simple ---")
        response1 = await engine.process_user_input("user123", "Hola, ¿cómo estás?")
        print(f"Respuesta del Motor: {response1.get('response')}")
        print(f"¿Acción requerida?: {response1.get('action_required')}")

        print("\n--- Test 2: Mensaje de cálculo ---")
        response2 = await engine.process_user_input("user123", "Necesito calcular 2 + 2")
        print(f"Respuesta del Motor: {response2.get('response')}")
        print(f"¿Acción requerida?: {response2.get('action_required')}")
        if response2.get('action_required'):
            print(f"Datos de acción: {response2.get('action_data')}")

        print("\n--- Test 3: Pregunta de hora ---")
        response3 = await engine.process_user_input("user456", "Qué hora es?")
        print(f"Respuesta del Motor: {response3.get('response')}")

        print("\n--- Test 4: Mensaje con contexto ---")
        context_data = {"ultima_consulta": "clima en NYC", "preferencias_usuario": {"unidades": "metricas"}}
        response4 = await engine.process_user_input("user789", "muéstrame el contexto", context_data)
        print(f"Respuesta del Motor: {response4.get('response')}")

        print("\n--- Test 5: Mensaje vacío (manejo de errores) ---")
        response5 = await engine.process_user_input("user999", "")
        print(f"Resultado del Motor (vacío): {response5.get('error', 'No se detectó error específico.')}")

        print("\n--- Test 6: ID de usuario vacío (manejo de errores) ---")
        response6 = await engine.process_user_input("", "Hola!")
        print(f"Resultado del Motor (ID vacío): {response6.get('error', 'No se detectó error específico.')}")

    # Ejecuta la función principal asíncrona de pruebas.
    asyncio.run(main_test_suite())