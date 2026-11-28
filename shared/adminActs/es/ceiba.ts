/**
 * The Ceiba's acts in Spanish, by act id (the English is shared/adminActs/ceiba.ts). The Spanish is awaiting a native reader.
 */
import { words, type ActWords } from "../types";

export const CEIBA_WORDS_ES: Readonly<Record<string, ActWords>> = {
  "ceiba.road.read": words("El camino al lanzamiento", "Cada requisito entre aquí y la votación que empieza el Juego, en orden.", ["lanzamiento", "camino al lanzamiento", "lista de pendientes", "salir en vivo", "requisitos"]),
  "ceiba.requirement.confirm": words("Marcar un requisito de lanzamiento como hecho, deshacerlo o rechazarlo", "Confirme un requisito que una persona tiene que dar por cierto, retire la confirmación, o rechácelo dejando registro.", ["marcar hecho", "confirmar requisito", "quitar confirmación", "rechazar requisito"]),
  "ceiba.purpose.save": words("Escribir la declaración de propósito", "La frase propia de la aldea sobre para qué existe.", ["propósito", "declaración de propósito", "para qué estamos", "razón de ser"]),
  "ceiba.email-plot.read": words("La parcela del correo", "Los pasos que dejan funcionando el correo de la aldea, como una parcela del jardín de configuración.", ["parcela del correo", "configurar el correo", "puesta en marcha del correo"]),
  "ceiba.test-run.run": words("Correr el ensayo", "Avanza varias lunas con los ajustes propios de esta aldea, como un ensayo.", ["ensayo", "prueba sin cambios", "simular", "practicar", "simulación"]),
  "ceiba.hand-over.read": words("Entregar los poderes a la aldea", "Pasa los poderes del equipo fundador a los roles de la aldea. Hacen falta dos firmas y un tiempo de espera.", ["la entrega", "entregar poderes", "pasar poderes", "dos firmas", "custodios"]),
  "ceiba.stewards.read": words("La lista de custodios", "A quién se propone para ocupar los roles de la aldea cuando empiece el Juego.", ["lista de custodios", "custodios", "quién va a guiar", "candidatos a custodio"]),
  "ceiba.vote.start": words("Empezar la votación de lanzamiento", "Pídale a la aldea que empiece su Juego, con la lista de custodios que se vota.", ["empezar la votación", "votación de lanzamiento", "empezar el juego", "proponer el lanzamiento"]),
  "ceiba.canvas.save-season": words("Escribir la temporada en el lienzo", "Lo que la aldea quiere hacer esta temporada, en su lienzo.", ["lienzo", "lienzo de temporada", "lienzo de la aldea", "intenciones"]),
  "ceiba.canvas.clear-season": words("Borrar la temporada del lienzo", "Quita del lienzo las palabras de la temporada.", ["borrar lienzo", "reiniciar el lienzo de temporada"]),
  "ceiba.import.door": words("Empezar desde un archivo de perfil", "Traiga el archivo de perfil de una aldea al inicio de Hágalo suyo. Llena las casillas de identidad, sin guardar.", ["importar", "importar perfil", "archivo de perfil", "traer un archivo"]),
  "ceiba.field-notes.read": words("Notas de campo", "El jardín de configuración como una lista sencilla, para un lector de pantalla o para quien prefiera leer una tabla.", ["notas de campo", "vista de lista", "vista de tabla"]),
  "ceiba.claim.village": words("Reclamar la aldea", "Crea la primera cuenta fundadora de una aldea que todavía no tiene ninguna.", ["reclamar", "primera persona fundadora", "reclamar la aldea", "cuenta fundadora"]),
};
