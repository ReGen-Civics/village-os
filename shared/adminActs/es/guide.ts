/**
 * The guide's acts in Spanish, by act id (the English is shared/adminActs/guide.ts). The Spanish is awaiting a native reader.
 */
import { words, type ActWords } from "../types";

export const GUIDE_WORDS_ES: Readonly<Record<string, ActWords>> = {
  "guide.dock.ask": words("Preguntarle a la guía", "Pregúntele a la guía de la aldea dónde está algo en Admin, o qué hace un ajuste.", ["guía", "asistente", "preguntar", "ayuda", "ayúdeme"]),
  "guide.guide.launch": words("Preguntarle a la guía de lanzamiento", "Converse con la guía sobre el camino al lanzamiento.", ["guía de lanzamiento", "ayuda con el lanzamiento", "qué sigue para lanzar"]),
  "guide.guide.organize": words("Pedirle a la guía que ayude a organizar la aldea", "Converse con la guía sobre círculos y roles. Lo que ella redacta espera a que una persona lo acepte.", ["organizar la aldea", "borradores de roles", "borradores de círculos", "ayuda para organizar"]),
  "guide.brain.save": words("Cambiar lo que la guía sabe de la aldea", "Edite una sección del resumen de la aldea, que la guía lee antes de responder.", ["lo que sabe la guía", "memoria de la aldea", "resumen de la aldea", "enseñarle a la guía"]),
  "guide.brain.confirm": words("Confirmar una sección del resumen de la aldea", "Diga que una sección del resumen sigue siendo cierta tal como está.", ["confirmar resumen", "sigue siendo cierto", "revisar el resumen"]),
  "guide.name.set": words("Ponerle nombre a la guía de la aldea", "El nombre con el que responde la guía en esta aldea.", ["nombre de la guía", "nombre del asistente", "renombrar la guía"]),
  "guide.memory.link": words("El camino al tablero de memoria organizacional", "Una etiqueta en el encabezado de Admin que abre el tablero de memoria organizacional, y la pantalla que le trae de vuelta.", ["tablero de memoria", "memoria organizacional", "memoria de la organización"]),
  "guide.setup.banner": words("Configure su guía primero", "Un aviso arriba en Inicio y en Hágalo suyo mientras ninguna guía puede responder. Lleva a la clave de la guía.", ["configurar la guía", "clave de la guía", "configurar la ia", "no hay guía"]),
};
