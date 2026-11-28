/**
 * The Spring's acts in Spanish, by act id (the English is shared/adminActs/spring.ts). The Spanish is awaiting a native reader.
 */
import { words, type ActWords } from "../types";

export const SPRING_WORDS_ES: Readonly<Record<string, ActWords>> = {
  "spring.launch.checks": words("Los requisitos de lanzamiento, revisados en vivo", "Cada requisito de lanzamiento con lo que lo prueba, leído de nuevo cada vez que se abre la página.", ["requisitos de lanzamiento", "revisiones", "qué está en verde", "pruebas", "salud"]),
  "spring.connections.strip": words("La franja de conexiones", "Una línea por cada servicio externo: conectado, o lo que todavía le falta.", ["conexiones", "estado de las conexiones", "está conectado", "servicios externos"]),
  "spring.seeds.proof": words("Las semillas de configuración y lo que prueba cada una", "Cada clave y ajuste que la aldea planta, con si está viva, solo presente o todavía por hacer.", ["semillas de configuración", "semillas", "jardín", "qué está plantado", "estados de prueba"]),
  "spring.signing-key.rotate": words("Reemplazar la clave de firma de la aldea", "Crea una clave nueva para firmar lo que la aldea envía a otras aldeas. Primero le pide confirmar.", ["clave de firma", "cambiar la clave", "nueva clave de firma", "clave de identidad"]),
  "spring.signing-key.decline": words("Rechazar un reemplazo de clave de firma en espera", "Rechace una clave de firma nueva que pidió otra persona administradora.", ["rechazar cambio de clave", "negar clave nueva"]),
  "spring.voice.choose": words("Elegir quién pasa a texto las grabaciones de voz", "Qué servicio convierte en texto la grabación de quien solicita.", ["transcripción de voz", "transcribir", "voz a texto", "pasar audio a texto"]),
  "spring.agents.set-account": words("Marcar una cuenta como de un agente", "Diga que una cuenta pertenece a un agente de software, o que vuelve a ser de una persona.", ["cuenta de agente", "cuenta de bot", "agente de software", "agente de ia"]),
  "spring.agents.paths": words("Definir qué rutas de administración puede llamar un agente", "La lista de rutas de administración abiertas a los agentes, y quién confirma cada escritura.", ["rutas del agente", "permisos del agente", "lista permitida", "rutas del conector"]),
  "spring.agents.full-access": words("Darle acceso total al agente de un rol", "Nombre el único rol cuyo agente puede llegar a las rutas de administración con el sí de quien lo ocupa.", ["acceso total", "súper agente", "agente de mi rol"]),
  "spring.agents.reads-open": words("Dejar que el agente con acceso total lea sin preguntar", "Si el agente del rol con acceso total lee sin la lista guardada. Las escrituras siguen preguntando.", ["lecturas abiertas", "lecturas del agente", "leer sin permiso"]),
  "spring.agents.undo": words("Deshacer algo que hizo un agente", "Retira un acto registrado de un agente.", ["deshacer agente", "acciones del agente", "revertir cambio del agente"]),
  "spring.agents.approval": words("Registrar la aprobación de la aldea a los agentes de IA", "Registre que la aldea aprueba que los agentes de IA lean datos de solicitantes y miembros, o retire esa aprobación, con una nota.", ["aprobación de agentes de ia", "aprobar agentes", "datos de solicitantes", "permiso para la ia"]),
};
