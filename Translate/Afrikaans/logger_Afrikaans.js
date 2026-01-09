// Translate/Afrikaans/logger_Afrikaans.js
//  Controlador semántico de traducciones afrikáans para módulo de auditoría (texto plano en español)

export const logger_Afrikaans = {
  acciones: {
    create: "Registro creado",
    update: "Registro actualizado",
    delete: "Registro eliminado",
    rollback: "Cambio revertido",
    restore: "Restaurar entrada",
    confirm_delete: "Confirmar eliminación",
    permanent_delete: "Eliminar permanentemente",
    manual_edit: "Edición manual",
    auto_sync: "Sincronización automática",
    success: "Cambio guardado correctamente",
    error: "Error al registrar",
  },

  campos: {
    field: "Campo",
    value: "Valor",
    previous_value: "Valor anterior",
    new_value: "Nuevo valor",
    field_changed: "Campo modificado",
    no_changes: "No se detectaron cambios",
    reason: "Motivo del cambio",
    impact: "Impacto en el sistema",
  },

  usuario: {
    user: "Usuario",
    created_by: "Creado por",
    modified_by: "Modificado por",
    agent: "Agente responsable",
    session_id: "ID de sesión",
    unauthorized: "Sin autorización",
    unknown: "Desconocido",
  },

  sistema: {
    timestamp: "Marca de tiempo",
    last_modified: "Última modificación",
    version: "Versión del sistema",
    module: "Módulo",
    origin: "Origen",
    destination: "Destino",
    system_event: "Evento del sistema",
  },

  auditoria: {
    audit_log: "Registro de auditoría",
    change_summary: "Resumen de cambios",
    viewing_log: "Visualizando registro de auditoría",
    integrity_check: "Verificación de integridad",
    verified: "Verificado",
    not_verified: "No verificado",
  },

  interfaz: {
    loading: "Cargando datos de auditoría...",
    empty_log: "No hay datos de auditoría disponibles",
    entry_saved: "Entrada guardada",
    entry_removed: "Entrada eliminada",
  },

  filtros: {
    filter_by_user: "Filtrar por usuario",
    filter_by_field: "Filtrar por campo",
    filter_by_date: "Filtrar por fecha",
  },

  intercambio: {
    export: "Exportar registro de auditoría",
    import: "Importar registro de auditoría",
  },

  metricas: {
    log_size: "Tamaño del registro",
  },

  validacion: {
    missing_key: "Clave de traducción no encontrada",
    invalid_context: "Contexto de traducción inválido",
    fallback_message: "Mensaje predeterminado aplicado",
  },
};

function procesarEntradaUsuario(texto, usuario) {
  const conocimiento =
    db.getCollection("conocimiento") ||
    db.addCollection("conocimiento", {
      unique: ["palabra"],
      indices: ["usuario"],
    });

  const palabrasClave = extraerPalabrasClave(texto);
  const nuevas = palabrasClave.filter(
    (p) => !conocimiento.findOne({ palabra: p })
  );

  nuevas.forEach((palabra) => {
    conocimiento.insert({
      palabra,
      significado: "Pendiente",
      contexto: "Detectada en texto plano",
      usuario,
      fecha_registro: new Date().toISOString(),
    });

    registrarAuditoria({
      tipo: "aprendizaje",
      campo: "palabra",
      nuevo: palabra,
      usuario,
      fecha: new Date().toISOString(),
      modulo: "conocimiento",
    });

    console.log(
      ` Nueva palabra encontrada: "${palabra}" añadida al campo de conocimiento`
    );
  });

  // Ejemplo: si contiene "esternocleidomastoideo", activar generación visual
  if (palabrasClave.includes("esternocleidomastoideo")) {
    generarImagen("músculo esternocleidomastoideo en vista anatómica");
  }
}
