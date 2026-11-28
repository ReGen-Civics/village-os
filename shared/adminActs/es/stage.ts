/**
 * The Stage's acts in Spanish, by act id (the English is shared/adminActs/stage.ts). The Spanish is awaiting a native reader.
 */
import { words, type ActWords } from "../types";

export const STAGE_WORDS_ES: Readonly<Record<string, ActWords>> = {
  "stage.plan.save": words("Cambiar el plan de la aldea", "Edite el plan del que se dibuja el tablero.", ["plan", "editor del plan", "tablero de la aldea", "hoja de ruta", "centro de mando"]),
  "stage.timeline.owner": words("Definir en qué estado está un elemento de la línea de tiempo", "Marque la etapa de un elemento de la línea de tiempo, como iniciado o entregado.", ["línea de tiempo", "responsable", "estado de entrega", "avance del elemento"]),
  "stage.timeline.import-owners": words("Traer los responsables de la línea de tiempo", "Carga desde una lista quién es responsable de cada elemento de la línea de tiempo.", ["importar responsables", "lista de responsables", "cargar responsables"]),
  "stage.kanban.move": words("Mover una tarjeta del kanban", "Mueva una tarjeta a otra columna, y diga quién la tiene.", ["kanban", "tarjeta", "mover tarjeta", "asignar tarjeta", "columnas"]),
  "stage.checklist.tick": words("Marcar un elemento del tablero", "Marque un elemento de la lista del tablero como hecho o sin hacer.", ["casilla", "marcar hecho", "lista de verificación", "marcar casilla"]),
  "stage.decisions.record": words("Registrar una decisión en el tablero", "Diga en qué va una decisión, qué se eligió y cualquier nota.", ["decisión", "decisiones", "qué elegimos", "registro de decisiones"]),
  "stage.timeline.note": words("Escribir una nota en un elemento de la línea de tiempo", "Agregue o cambie la nota bajo un elemento de la línea de tiempo del tablero.", ["nota de entrega", "nota de la línea de tiempo", "nota de un entregable"]),
  "stage.documents.save": words("Cambiar un documento de trabajo", "Edite una sección de los documentos de trabajo del tablero.", ["documentos de trabajo", "documento", "notas", "texto del tablero"]),
  "stage.documents.links": words("Cambiar los enlaces del tablero a documentos", "La lista de documentos y enlaces que el tablero tiene a la mano.", ["recursos", "enlaces", "enlaces a documentos"]),
  "stage.discussion.read": words("La conversación del tablero", "Notas dejadas en el tablero. Hoy se guardan en un solo navegador.", ["conversación", "comentarios", "notas en el tablero", "discusión"]),
  "stage.milestones.add": words("Agregar un hito de construcción", "Agregue algo construido o por construir, con su fase, en qué va y una nota.", ["hito", "avance de la construcción", "qué se construyó", "actualización de avance"]),
  "stage.milestones.edit": words("Cambiar un hito de construcción", "Cambie las palabras de un hito o en qué va.", ["editar hito", "actualizar avance"]),
  "stage.milestones.remove": words("Quitar un hito de construcción", "Saca un hito de la página.", ["eliminar hito", "borrar hito"]),
  "stage.links.read": words("Los enlaces rápidos del tablero", "Una lista fija de puertas a otras páginas, en el tablero.", ["enlaces rápidos", "atajos", "puertas"]),
};
