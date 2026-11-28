/**
 * The Hall's acts in Spanish, by act id (the English is shared/adminActs/hall.ts). The Spanish is awaiting a native reader.
 */
import { words, type ActWords } from "../types";

export const HALL_WORDS_ES: Readonly<Record<string, ActWords>> = {
  "hall.review.waiting": words("Revisión: lo que espera", "Todas las colas en una sola lista: lo que espera su decisión, lo más antiguo primero.", ["revisión", "en espera", "cola de revisión", "qué falta decidir", "pendientes de revisar"]),
  "hall.review.held": words("Revisión: lo que está retenido", "Cambios detenidos antes de salir en vivo, hasta que alguien los libere o los descarte.", ["retenidos", "en pausa", "cambios retenidos", "cambios detenidos"]),
  "hall.review.decided": words("Revisión: lo que se decidió", "Lo que se aceptó o se dejó de lado, y quién lo hizo.", ["decididos", "historial de revisión", "aceptados", "decisiones pasadas"]),
  "hall.review.find": words("Buscar un elemento de revisión por su código", "Escriba un código como B-71 o B-71.2 para abrir ese lote o ese cambio.", ["buscar por código", "código de lote", "código de cambio", "encontrar un lote"]),
  "hall.changes.accept": words("Aceptar cambios propuestos", "Acepta los cambios que usted seleccionó. Cada uno pasa por la puerta de su propia página, a nombre de usted.", ["aceptar cambios", "aprobar cambios", "aceptar varios", "propuestas del agente"]),
  "hall.changes.discard": words("Dejar de lado cambios propuestos", "Deja de lado los cambios que usted seleccionó. Nada en vivo se mueve.", ["descartar cambios", "rechazar cambios", "dejar de lado", "ignorar propuestas"]),
  "hall.changes.edit": words("Editar un cambio propuesto antes de aceptarlo", "Cambie las palabras propuestas ahí mismo. La diferencia se guarda para que la próxima propuesta aprenda de ella.", ["editar propuesta", "corregir el texto", "ajustar un cambio", "cambiar las palabras"]),
  "hall.changes.put-back": words("Devolver un cambio decidido a la espera", "Regresa a la lista de espera un cambio que se dejó de lado o que falló.", ["devolver a la espera", "reabrir cambio", "deshacer descarte", "restaurar propuesta"]),
  "hall.changes.release-held": words("Liberar un cambio retenido", "Deja que un cambio retenido siga adelante.", ["liberar cambio", "soltar retenido", "dejar pasar"]),
  "hall.changes.clear-held": words("Descartar un cambio retenido", "Suelta un cambio retenido sin aplicarlo.", ["descartar retenido", "quitar retenido", "borrar cambio retenido"]),
  "hall.org-drafts.publish": words("Publicar un borrador del organigrama", "Pone directamente en el organigrama un cambio en borrador a círculos y roles.", ["publicar borrador", "borrador del organigrama", "aplicar borrador"]),
  "hall.org-drafts.withdraw": words("Retirar un borrador del organigrama", "Saca un borrador de la lista de revisión sin publicarlo.", ["retirar borrador", "cancelar borrador", "quitar borrador"]),
  "hall.org-drafts.revert": words("Revertir un borrador del organigrama ya publicado", "Deshace un borrador que se publicó y deja el organigrama como estaba.", ["revertir borrador", "deshacer publicación", "volver el organigrama atrás"]),
  "hall.forms.set-status": words("Responder un formulario", "Marque un formulario como atendido, aceptado o rechazado. Una propuesta aceptada puede llevar el efectivo acordado.", ["formularios", "responder solicitud", "aceptar o rechazar", "marcar como atendido", "postulación"]),
  "hall.forms.handle": words("Posponer un formulario o pasárselo a alguien", "Aparte un formulario hasta una fecha, o páselo a un rol o a una persona para que lo responda.", ["posponer", "pasar a otra persona", "asignar formulario", "recordármelo después"]),
  "hall.forms.delete": words("Eliminar un formulario", "Quita un formulario de la lista.", ["eliminar formulario", "borrar solicitud", "correo basura", "spam"]),
  "hall.forms.undo": words("Deshacer la última acción en un formulario", "Retire la respuesta que acaba de dar a un formulario, mientras Deshacer siga a la vista.", ["deshacer formulario", "me equivoqué", "retirar respuesta"]),
  "hall.join.accept": words("Aceptar una solicitud para unirse", "Diga que sí a alguien que pidió unirse.", ["solicitud para unirse", "aceptar miembro", "dejar entrar", "quiere unirse"]),
  "hall.join.decline": words("Rechazar una solicitud para unirse", "Diga que no a alguien que pidió unirse.", ["rechazar solicitud", "decir que no", "no admitir"]),
  "hall.open-proposals.settings": words("Propuestas abiertas: el enlace público y el plazo", "Si cualquiera con el enlace puede proponer un rol o una misión, y el plazo por el que se ofrece una propuesta.", ["propuestas abiertas", "propuestas públicas", "enlace de propuestas", "plazo de propuesta"]),
  "hall.open-proposals.new-link": words("Crear un enlace privado de propuesta", "Cree un enlace para entregarle a una persona o a un grupo y que puedan proponer.", ["enlace privado", "invitar a proponer", "nuevo enlace de propuesta"]),
  "hall.open-proposals.revoke-link": words("Retirar un enlace de propuesta", "Hace que un enlace privado de propuesta deje de funcionar.", ["retirar enlace", "revocar enlace", "apagar enlace"]),
  "hall.open-proposals.transcribe": words("Pasar a texto las notas de voz en espera", "Pasa a texto cada nota de voz que espera en una propuesta abierta.", ["transcribir", "notas de voz", "grabaciones", "pasar audio a texto"]),
  "hall.feedback.set-status": words("Marcar un comentario como leído o resuelto", "Define en qué estado está un comentario recibido.", ["comentarios", "reporte de error", "sugerencias", "marcar como resuelto"]),
  "hall.reports.forum": words("Responder una publicación reportada del foro", "Marque una publicación reportada como resuelta o desestimada. A quien la reportó se le avisa que alguien la revisó.", ["publicación reportada", "moderación del foro", "reporte del foro", "denuncia en el foro"]),
  "hall.reports.message": words("Responder un mensaje reportado", "Marque un mensaje reportado como resuelto o desestimado.", ["mensaje reportado", "reporte de mensaje", "denuncia de mensaje"]),
  "hall.drafts.accept": words("Aceptar un borrador de la guía", "Acepte un borrador que escribió la guía, como un rol o un círculo. Puede editarlo antes.", ["borradores de la guía", "aceptar borrador", "borrador de rol", "borrador de círculo"]),
  "hall.drafts.reject": words("Descartar un borrador de la guía", "Descarte un borrador que escribió la guía, con una nota que diga por qué.", ["descartar borrador", "rechazar borrador", "no usar borrador"]),
  "hall.structure.accept": words("Aceptar cambios de estructura de una sincronización", "Acepte los círculos y roles que propuso una sincronización, un lote a la vez, después de una prueba en seco.", ["revisión de estructura", "sincronización", "lote de cambios", "prueba en seco"]),
  "hall.keys.cosign": words("Firmar también una clave de producción", "Dé la segunda firma que espera una clave de producción. Hace falta una segunda persona administradora, con su propia sesión.", ["segunda firma", "firmar clave", "clave de producción", "claves en espera"]),
  "hall.keys.decline": words("Rechazar una clave de producción", "Rechace una clave de producción que espera una segunda firma.", ["rechazar clave", "negar clave", "objetar una clave"]),
};
