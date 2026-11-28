/**
 * THE FRAME: what every Admin page wears. The header, the language, signing out, search, undo, night and light,
 * the phone's navigation, the sign-in gate and the short view for a steward who is not an admin.
 *
 * These live in the browser or on a member's own doors, so none of them calls an admin route. Each is a read here:
 * a place the search can take a person to.
 */
import { POST, inPlace } from "./types";

export const FRAME_ACTS = inPlace("frame", [
  {
    id: "frame.header.read", parity: ["G2"], tab: "home", power: "admin",
    title: "The Admin header",
    help: "The bar across every Admin page: the village's name, the search, the guide and your account.",
    synonyms: ["header", "top bar", "admin bar"],
  },
  {
    id: "frame.language.choose", parity: ["G2"], tab: "home", power: "signed-in",
    title: "Change your language",
    help: "Read the site in another language the village offers. The picker is in the Admin header.",
    synonyms: ["language", "spanish", "english", "translate", "idioma"],
  },
  {
    id: "frame.account.sign-out", parity: ["G2"], tab: "home", power: "signed-in",
    title: "Sign out",
    help: "End your session on this device.",
    synonyms: ["sign out", "log out", "logout", "leave"],
    route: POST("/api/auth/logout"),
  },
  {
    id: "frame.search.open", parity: ["G21"], tab: "home", power: "admin",
    title: "Search Admin",
    help: "Find any Admin page, control or dial by its name. Press Ctrl K anywhere.",
    synonyms: ["search", "find", "ctrl k", "command k", "look up"],
  },
  {
    id: "frame.undo.use", parity: ["G22"], tab: "home", power: "admin",
    title: "Undo",
    help: "Take back the last thing you did in Admin, while Undo is still showing.",
    synonyms: ["undo", "take back", "oops", "revert"],
  },
  {
    id: "frame.theme.choose", parity: ["G2", "G24"], tab: "home", power: "signed-in",
    title: "Night and light",
    help: "Choose whether the site draws in its night look or its light look. The switch is in the Admin header.",
    synonyms: ["dark mode", "light mode", "night", "theme", "appearance"],
  },
  {
    id: "frame.phone.menu", parity: ["G25"], tab: "home", power: "admin",
    title: "Admin on a phone",
    help: "The menu Admin shows on a narrow screen.",
    synonyms: ["phone", "mobile", "small screen", "menu button"],
  },
  {
    id: "frame.gate.sign-in", parity: ["G28"], tab: "home", power: "admin",
    title: "The Admin sign-in gate",
    help: "What a person sees when they open Admin without being signed in as an admin.",
    synonyms: ["sign in", "admin login", "gate", "not an admin"],
  },
  {
    id: "frame.steward.view", parity: ["G29"], tab: "home", power: "signed-in",
    title: "The short view for a steward",
    help: "What Admin shows a steward who holds a power and is not an admin.",
    synonyms: ["steward view", "simple view", "member view", "read only admin"],
  },
  {
    id: "frame.launch.banner", tab: "home", power: "admin", parity: ["G1"],
    title: "The launch banner",
    help: "A line across Admin about where the village stands on its way to launch.",
    synonyms: ["launch banner", "launch status"],
  },
  {
    id: "frame.help.open", tab: "home", power: "admin", parity: ["G14"],
    title: "What is this page?",
    help: "A button on every Admin page that says in plain words what the page is for.",
    synonyms: ["help", "what is this", "explain this page"],
  },
  {
    id: "frame.rail.read", tab: "home", power: "admin", parity: ["G26"],
    title: "The Admin menu",
    help: "The list of every Admin page, down the side.",
    synonyms: ["menu", "side menu", "nav", "rail", "all pages"],
  },
]);
