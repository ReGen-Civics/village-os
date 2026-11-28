/**
 * The frame's acts in Spanish, by act id (the English is shared/adminActs/frame.ts). The Spanish is awaiting a native reader.
 */
import { words, type ActWords } from "../types";

export const FRAME_WORDS_ES: Readonly<Record<string, ActWords>> = {
  "frame.header.read": words("El encabezado de Admin", "La barra en lo alto de cada página de Admin: el nombre de la aldea, la búsqueda, la guía y su cuenta.", ["encabezado", "barra de arriba", "barra de admin", "cabecera"]),
  "frame.language.choose": words("Cambiar su idioma", "Lea el sitio en otro idioma que ofrece la aldea. El selector está en el encabezado de Admin.", ["idioma", "español", "inglés", "traducir", "cambiar de idioma"]),
  "frame.account.sign-out": words("Cerrar sesión", "Termine su sesión en este dispositivo.", ["cerrar sesión", "salir de la cuenta", "desconectarse", "salir"]),
  "frame.search.open": words("Buscar en Admin", "Encuentre cualquier página, control o ajuste de Admin por su nombre. Presione Ctrl K en cualquier lugar.", ["buscar", "buscador", "encontrar", "búsqueda", "ctrl k"]),
  "frame.undo.use": words("Deshacer", "Retire lo último que hizo en Admin, mientras Deshacer siga a la vista.", ["deshacer", "me equivoqué", "volver atrás", "revertir"]),
  "frame.theme.choose": words("Claro u oscuro", "Elija si el sitio se dibuja en su aspecto de noche o en su aspecto claro. El interruptor está en el encabezado de Admin.", ["modo oscuro", "modo claro", "noche y día", "tema", "apariencia"]),
  "frame.phone.menu": words("Admin en un teléfono", "El menú que muestra Admin en una pantalla angosta.", ["teléfono", "celular", "pantalla pequeña", "botón del menú"]),
  "frame.gate.sign-in": words("La puerta de inicio de sesión de Admin", "Lo que ve una persona cuando abre Admin sin haber iniciado sesión como administradora.", ["iniciar sesión", "entrar a admin", "ingreso de administración", "no soy administrador"]),
  "frame.steward.view": words("La vista corta para un custodio", "Lo que Admin le muestra a un custodio que tiene un poder y no es administrador.", ["vista de custodio", "vista sencilla", "vista de miembro", "admin de solo lectura"]),
  "frame.launch.banner": words("El aviso de lanzamiento", "Una línea a lo ancho de Admin sobre en qué va la aldea en su camino al lanzamiento.", ["aviso de lanzamiento", "estado del lanzamiento", "franja de lanzamiento"]),
  "frame.help.open": words("¿Qué es esta página?", "Un botón en cada página de Admin que dice en palabras sencillas para qué es la página.", ["ayuda", "qué es esto", "explicar esta página", "para qué sirve"]),
  "frame.rail.read": words("El menú de Admin", "La lista de todas las páginas de Admin, al costado.", ["menú", "menú lateral", "navegación", "todas las páginas"]),
};
