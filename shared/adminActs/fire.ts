/**
 * THE FIRE: today. What needs a person now, and the switches Home keeps on this device.
 *
 * Nothing here writes to the server: Home reads lists the other places own, and its switches live in the browser
 * (client/src/components/admin/HomeBase.tsx, AdminFeel.tsx). So every row is a read.
 */
import { inPlace } from "./types";

export const FIRE_ACTS = inPlace("fire", [
  {
    id: "fire.today.needs-you", parity: ["A1", "G30", "G31"], tab: "home", power: "admin",
    title: "What needs you now",
    help: "The one next thing waiting on you, and where to go for it.",
    synonyms: ["needs you", "waiting on me", "to do", "next step", "today", "inbox"],
  },
  {
    id: "fire.today.role-applications", parity: ["A1", "G30"], tab: "home", power: "admin",
    title: "Role applications waiting",
    help: "Role applications that wait for an answer. They are listed on Home and never folded into a count.",
    synonyms: ["applications", "applicants", "role applications", "who applied"],
  },
  {
    id: "fire.today.all-clear", parity: ["G7"], tab: "home", power: "admin",
    title: "The all-clear line",
    help: "What Home says when nothing is waiting on you.",
    synonyms: ["all clear", "nothing waiting", "done for today"],
  },
  {
    id: "fire.today.week", parity: ["G8"], tab: "home", power: "admin",
    title: "This week's count",
    help: "How many things you handled this week, kept on this device.",
    synonyms: ["this week", "weekly recap", "handled"],
  },
  {
    id: "fire.today.start-page", parity: ["G11"], tab: "home", power: "admin",
    title: "Start page on this device",
    help: "Whether Admin opens on Home or on the form list. Kept on this device only.",
    synonyms: ["start page", "home page", "open on", "landing page"],
  },
  {
    id: "fire.today.device-switches", parity: ["G9", "G10"], tab: "home", power: "admin",
    title: "On this device",
    help: "The switches for the tour, the gentle quests, the weekly line and the short menu. Kept on this device only.",
    synonyms: ["device", "tour", "gentle quests", "simple menu", "show everything"],
  },
  {
    id: "fire.today.tour", parity: ["G5"], tab: "home", power: "admin",
    title: "The short tour",
    help: "Five steps through Admin for somebody new. It can be played again from Home.",
    synonyms: ["tour", "walk through", "getting started", "replay tour"],
  },
  {
    id: "fire.today.gentle-quests", parity: ["G6"], tab: "home", power: "admin",
    title: "Gentle quests",
    help: "A few optional first things to try in Admin, shown on Home.",
    synonyms: ["gentle quests", "first things to try", "starter quests"],
  },
  {
    id: "fire.today.areas", parity: ["A1", "G33"], tab: "home", power: "admin",
    title: "The six areas",
    help: "Every Admin page, grouped into six plain areas on Home.",
    synonyms: ["areas", "sections", "all pages", "map of admin"],
  },
  {
    id: "fire.today.inbox", tab: "home", power: "admin", parity: ["G32"],
    title: "Everything people sent, in one list",
    help: "What people sent that still waits, gathered into one list on Home.",
    synonyms: ["unified inbox", "inbox", "everything waiting", "one list"],
  },
]);
