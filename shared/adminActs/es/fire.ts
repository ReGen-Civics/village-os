/**
 * The Fire's acts in Spanish, by act id (the English is shared/adminActs/fire.ts). The Spanish is awaiting a native reader.
 */
import { words, type ActWords } from "../types";

export const FIRE_WORDS_ES: Readonly<Record<string, ActWords>> = {
  "fire.today.needs-you": words("Lo que lo necesita ahora", "Lo próximo que espera por usted, y a dónde ir para atenderlo.", ["pendientes", "qué me toca", "tareas de hoy", "siguiente paso", "bandeja"]),
  "fire.today.role-applications": words("Solicitudes de roles en espera", "Las solicitudes de roles que esperan una respuesta. Aparecen en Inicio y nunca se esconden dentro de un conteo.", ["solicitudes de roles", "postulaciones", "quién se postuló", "candidatos"]),
  "fire.today.all-clear": words("La línea de todo al día", "Lo que dice Inicio cuando nada espera por usted.", ["todo al día", "nada pendiente", "listo por hoy"]),
  "fire.today.week": words("El conteo de esta semana", "Cuántas cosas atendió esta semana, guardado en este dispositivo.", ["esta semana", "resumen semanal", "cosas atendidas"]),
  "fire.today.start-page": words("Página de inicio en este dispositivo", "Si Admin abre en Inicio o en la lista de formularios. Se guarda solo en este dispositivo.", ["página de inicio", "dónde abre admin", "pantalla inicial", "abrir en"]),
  "fire.today.device-switches": words("En este dispositivo", "Los interruptores del recorrido, las misiones suaves, la línea semanal y el menú corto. Se guardan solo en este dispositivo.", ["dispositivo", "menú corto", "mostrar todo", "interruptores", "preferencias"]),
  "fire.today.tour": words("El recorrido corto", "Cinco pasos por Admin para quien llega por primera vez. Se puede repetir desde Inicio.", ["recorrido", "repetir el recorrido", "cómo empezar", "primeros pasos"]),
  "fire.today.gentle-quests": words("Misiones suaves", "Unas pocas cosas opcionales para probar primero en Admin, que se muestran en Inicio.", ["misiones suaves", "qué probar primero", "misiones para empezar"]),
  "fire.today.areas": words("Las seis áreas", "Cada página de Admin, agrupada en seis áreas sencillas en Inicio.", ["áreas", "secciones", "todas las páginas", "mapa de admin"]),
  "fire.today.inbox": words("Todo lo que la gente envió, en una sola lista", "Lo que la gente envió y todavía espera, reunido en una sola lista en Inicio.", ["bandeja de entrada", "bandeja única", "todo lo pendiente", "una sola lista"]),
};
