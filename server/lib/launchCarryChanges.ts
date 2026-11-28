/**
 * WHAT CHANGES WHEN THE LAUNCH VOTE CARRIES, AND WHO IT REACHES.
 *
 * A launch flips a dozen doors in one request, and until now the only way to
 * learn which was to carry the vote and meet them. This is the list, read
 * BEFORE the vote: every door that changes, how it stands today, how it
 * stands after, who holds it then, and which administrators pass it today and
 * will not.
 *
 * READ-ONLY. Nothing here writes, and the route that serves it
 * (server/routes/launchCarryChanges.ts) reads only what the doors themselves
 * read.
 *
 * ── TWO FACTS, AND A VILLAGE CAN BE PAST ONE AND NOT THE OTHER ──────────────
 *
 * The code asks "has this village launched" in two ways:
 *
 *   GAME START     `readGameStart` (server/lib/gameStart.ts). Issuance, the
 *                  founder's own powers, the voting-rule dials.
 *   THE LAUNCH     `launch-state.launchedByBallotId` and `launchedAt`
 *                  (server/lib/launch.ts), written only when a launch vote
 *                  carries. Every door in the second half of this list.
 *
 * A first launch sets both in one request. A village that was issuing before
 * the vote existed (migration 0112) is past the first and not the second, and
 * its ratifying vote sets only the second (server/lib/launchRatify.ts). So the
 * first group reads `already` for such a village and `flips` for a new one.
 *
 * ── WHO HOLDS A DOOR AFTER IS NOT KNOWN UNTIL THE VOTE ──────────────────────
 *
 * Most doors pass to "whoever holds the power", and at a launch that is the
 * steward role, filled by whoever the proposal names and who accepts. Before
 * a vote is open nobody is named. So this answers with what today's facts
 * support and says which it is: with a vote open, the people it named and who
 * have accepted so far; with none open, only whoever holds the power already.
 * An administrator is listed as losing a door when nothing known today would
 * keep them through it, and the sentence says what would.
 *
 * ── THE PREDICATES, AND WHERE EACH LIVES ────────────────────────────────────
 *
 *   module-switch    `switchVerdict`, shared/moduleSwitch.ts
 *   org-publish      `publishDoorFor`, server/lib/orgDraftDecide.ts
 *   pay              `holderDoor`, server/lib/holderDoor.ts (role.pay)
 *   budget-sources   `switchOffReason`, server/lib/budgets.ts
 *   token-mint       `handTokenMintToStewardsAndTreasury`, server/lib/tokenMintHandover.ts
 *   handover         `crossLaunchSelection`, server/lib/stewardship.ts
 *   keystone         `cosignPhase`, server/lib/plantingRequests.ts
 *   currency         server/routes/brand.ts
 *   checklist        `confirmManual`, server/lib/launch.ts
 *   season           `seasonTurnAtLaunch`, server/lib/launchSeasonTurn.ts
 *   moon-one         `anchorCycleFrom`, server/lib/villageMoon.ts
 *
 * The pay and budget-source doors need BOTH the launch on the record and
 * somebody seated as a steward, which is why their sentences say "once
 * somebody is seated".
 *
 * Every sentence is written in English and in Spanish here, so the screens
 * that come later show the server's words and never a second copy of them.
 */
import type { LaunchTurn } from "./launchSeasonTurn";

export interface Person {
  id: string;
  name: string;
}

export type CarryKind = "first" | "ratifying" | "carried";
export type CarryLang = "en" | "es";

/** `flips` at the carry; `already` true of this village; `nothing` to flip on today's facts. */
export type CarryStanding = "flips" | "already" | "nothing";

export type CarryChangeId =
  | "issuance"
  | "founder-powers"
  | "vote-rules"
  | "stewards"
  | "season"
  | "moon-one"
  | "module-switch"
  | "org-publish"
  | "pay"
  | "budget-sources"
  | "token-mint"
  | "handover"
  | "keystone"
  | "currency"
  | "checklist";

export interface AdminAccount extends Person {
  /** The account's role: admin or founder when it reaches the panel by role. */
  role: string;
  /** True when the account role itself is admin or founder. The gate's own admin step reads only this. */
  viaRole: boolean;
  /** Admin groups the account holds, by name. */
  groups: string[];
  /** Whether the account can sign in today. */
  present: boolean;
}

export interface CarryFacts {
  kind: CarryKind;
  /** The day issuance began, when the village was issuing before the vote. */
  issuingSince: string | null;
  launchedAt: string | null;
  admins: AdminAccount[];
  /** Live holders of each power the launch moves, as member ids. */
  holders: { pay: string[]; moduleSwitch: string[]; orgDecide: string[]; tokenMint: string[]; steward: string[] };
  roll: {
    kind: "founders" | "members";
    yesNeeded: number;
    onIt: Person[];
    notOnIt: Array<Person & { reason: "not_signed_in" | "left" }>;
  };
  /** Accounts holding the founder role that read as test accounts, and why. */
  testFounders: Array<Person & { why: TestReason }>;
  /** The open launch vote's steward list, or null when no vote is open. */
  slate: null | { named: Person[]; accepted: string[]; declined: string[] };
  /** The powers the launch hands to the village, by the title the admin list shows. */
  handover: string[];
  season: LaunchTurn;
  /** The civil date a steward seated by the carry would hold until, or why none can be seated. */
  stewardTerm: { endsOn: string | null; problem: string | null };
  tokenMint: { alreadyHeld: boolean; rolesWithSomebody: boolean; treasury: Person[] };
  /** Budget sources that are on because an admin switched them on. */
  adminSources: string[];
  currency: string | null;
  /** Whether Moon 1 is set by hand (`village.first_moon_at`). */
  moonSetByHand: boolean;
  nameOf(id: string): string;
}

export interface CarryChange {
  id: CarryChangeId;
  standing: CarryStanding;
  title: string;
  today: string;
  after: string;
  /** Who holds the door after the carry, as far as today's facts say. */
  holds: Person[];
  /** Administrators who pass this door today and will not after the carry. */
  loses: Person[];
}

export interface CarryAttention {
  id: "test-founder" | "roll-short" | "founders-away" | "nobody-accepted" | "season" | "admins-lose";
  text: string;
  accounts: Person[];
}

export interface CarryChanges {
  kind: CarryKind;
  issuingSince: string | null;
  launchedAt: string | null;
  summary: string;
  changes: CarryChange[];
  /** Every administrator, with the doors each would lose. Empty `loses` means none. */
  admins: Array<AdminAccount & { loses: CarryChangeId[] }>;
  attention: CarryAttention[];
}

// ── A founder account that reads as a test account ──────────────────────────

export type TestReason = "example" | "agent" | "qa-group" | "name" | "address";

const TEST_WORDS = ["qa", "test", "tests", "tester", "testing", "e2e", "integration", "demo", "dummy", "fake", "sample", "bot"];

/** True when a text carries one of the test words as a whole word (`integration-qa`, `TEST Ana`, `test+qa`). */
function hasTestWord(text: string): boolean {
  const words = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return words.some((w) => TEST_WORDS.includes(w));
}

/**
 * WHY AN ACCOUNT READS AS A TEST ACCOUNT, or null.
 *
 * A launch counts founders, and an account made to exercise the product can
 * hold the founder role like any other. Nothing in the data marks one, so this
 * reads what a person would: the flags the platform does keep, the QA viewers
 * group, and the name and the part of the address before the `@`, which is
 * where the house convention puts the word (`TEST Ana`, `test+qa@...`).
 *
 * The domain is deliberately not read. Reserved example domains are how every
 * fixture and many real placeholders are written, so on their own they say
 * nothing about one account among several.
 *
 * It is a prompt for a person to look, never a decision: nothing acts on it.
 */
export function testAccountReason(account: {
  name?: unknown;
  email?: unknown;
  isExample?: unknown;
  isAgent?: unknown;
  inQaGroup?: boolean;
}): TestReason | null {
  if (account.isExample === true || account.isExample === 1) return "example";
  if (account.isAgent === true || account.isAgent === 1) return "agent";
  if (account.inQaGroup) return "qa-group";
  if (hasTestWord(String(account.name ?? ""))) return "name";
  const local = String(account.email ?? "").split("@")[0] ?? "";
  if (hasTestWord(local)) return "address";
  return null;
}

// ── Words ───────────────────────────────────────────────────────────────────

const list = (names: readonly string[], and: string, none: string): string => {
  if (names.length === 0) return none;
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} ${and} ${names[names.length - 1]}`;
};

interface Words {
  and: string;
  nobody: string;
  summary: Record<CarryKind, (day: string) => string>;
  title: Record<CarryChangeId, string>;
  nothingChanges: string;
  issuance: { todayFirst: string; afterFirst: string; todayIssuing(day: string): string };
  founderPowers: { todayFirst: string; afterFirst: string; todayIssuing: string };
  voteRules: { todayFirst: string; afterFirst: string; todayIssuing: string };
  stewards: {
    todayNone: string;
    today(names: string, howMany: number): string;
    afterOpen(named: string, accepted: string, until: string): string;
    afterNoVote(until: string): string;
    until(day: string): string;
    noTerm(problem: string): string;
  };
  season: {
    today(name: string): string;
    todayNone: string;
    turned(to: string, from: string | null): string;
    beganToday(name: string): string;
    noNext: string;
  };
  moon: { today: string; todayByHand: string; after: string; afterByHand: string };
  moduleSwitch: { today: string; after: string };
  orgPublish: { today: string; after: string };
  pay: { today: string; after: string };
  sources: { todayNone: string; today(n: number, names: string): string; after: string; afterNone: string };
  tokenMint: { today: string; todayHeld: string; after: string; afterNobody: string };
  handover: { todayNone: string; today(n: number, titles: string): string; after: string; afterNone: string };
  keystone: { today: string; after: string };
  currency: { today(code: string): string; todayNone: string; after: string };
  checklist: { today: string; after: string };
  attention: {
    testFounder(name: string, why: TestReason, onRoll: boolean, yesNeeded: number): string;
    rollShort(on: number, need: number): string;
    foundersAway(names: string): string;
    nobodyAccepted: string;
    seasonNoNext: string;
    seasonNoEnd(name: string): string;
    adminsLose(n: number, names: string): string;
  };
}

const EN: Words = {
  and: "and",
  nobody: "nobody",
  summary: {
    first: () => "This village has not started its Game. Its launch vote starts issuance and passes the village's powers, in one request.",
    ratifying: (day) =>
      day
        ? `This village has been issuing since ${day} and has never held its launch vote. The vote puts the launch on the record and passes the village's powers. Issuance does not restart.`
        : "This village was issuing before the launch vote existed and has never held it. The vote puts the launch on the record and passes the village's powers. Issuance does not restart.",
    carried: (day) => (day ? `The launch carried on ${day}. Nothing is left to change.` : "The launch has carried. Nothing is left to change."),
  },
  title: {
    issuance: "Token issuance",
    "founder-powers": "What only a founder can do",
    "vote-rules": "The village's voting rules",
    stewards: "Who holds the steward role",
    season: "The season",
    "moon-one": "Moon 1",
    "module-switch": "Turning a module on",
    "org-publish": "Publishing the org chart",
    pay: "Quest pay, role pay and the budget",
    "budget-sources": "Budget sources an admin switched on",
    "token-mint": "Minting a token by hand",
    handover: "Powers the launch hands to the village",
    keystone: "Keystone secrets and the signing key",
    currency: "The village's currency",
    checklist: "The journey to launch",
  },
  nothingChanges: "Nothing changes.",
  issuance: {
    todayFirst: "Nothing can be issued to anybody.",
    afterFirst: "Issuance turns on, and the End of Moon shares approved before the vote are paid.",
    todayIssuing: (day) => (day ? `Issuance has been open since ${day}.` : "Issuance is already open."),
  },
  founderPowers: {
    todayFirst: "Only a founder changes an account's access, and a founder holds the hand-over control beside the stewards.",
    afterFirst: "Any admin changes an account's access, the stewards alone hold the hand-over control, and nobody new can be given the founder role.",
    todayIssuing: "This ended when issuance began.",
  },
  voteRules: {
    todayFirst: "An admin sets them on the panel.",
    afterFirst: "They close to the panel. Each one changes only by a village vote at the tier it needs.",
    todayIssuing: "They closed to the panel when issuance began.",
  },
  stewards: {
    todayNone: "Nobody holds the steward role.",
    today: (names, n) => `${names} ${n === 1 ? "holds" : "hold"} the steward role today.`,
    afterOpen: (named, accepted, until) =>
      `Whoever the open vote named and who accepts holds the steward role, with every power the village has to give${until}. Named: ${named}. Accepted so far: ${accepted}.`,
    afterNoVote: (until) =>
      `Whoever the proposal names and who accepts holds the steward role, with every power the village has to give${until}. The founder who opens the vote picks the names from the launch roll.`,
    until: (day) => `, until ${day}`,
    noTerm: (problem) => `Nobody can be seated as a steward on today's calendar. ${problem}`,
  },
  season: {
    today: (name) => `${name} is running.`,
    todayNone: "No season is running.",
    turned: (to, from) =>
      from
        ? `${to} begins that day, taking over from ${from}. Nothing else on the calendar moves, and every role keeps the end date it was given.`
        : `${to} begins that day. Nothing else on the calendar moves, and every role keeps the end date it was given.`,
    beganToday: (name) => `${name} began today, so a carry today begins nothing new. A carry on a later day begins the season after it.`,
    noNext: "No next season is on the calendar, so the season does not turn.",
  },
  moon: {
    today: "The village has no moon count yet.",
    todayByHand: "Moon 1 is set by hand in the village's settings.",
    after: "Moon 1 is the moon the carry falls in. Pay periods follow the moons as they always have, and none of them moves.",
    afterByHand: "The setting keeps deciding Moon 1. Pay periods do not move.",
  },
  moduleSwitch: {
    today: "Any admin turns a module on.",
    after: "Whoever holds the power to switch modules turns one on, or the village does by vote. An admin can still pause a module or turn one off.",
  },
  orgPublish: {
    today: "Any admin publishes a change to the org chart.",
    after: "Whoever holds the power to decide the org chart publishes it, or the change goes to a village vote.",
  },
  pay: {
    today: "An admin sets what a quest and a role pay, and keeps the budget.",
    after: "Once somebody is seated as a steward, only whoever holds the pay power does. While the steward role is empty an admin still can.",
  },
  sources: {
    todayNone: "No budget source is on because an admin switched it on.",
    today: (n, names) => (n === 1 ? `One budget source is on because an admin switched it on: ${names}.` : `${n} budget sources are on because an admin switched them on: ${names}.`),
    after: "Once somebody is seated as a steward, each one stops adopting lines by itself. Its next import waits for review until whoever holds the pay power switches it on again.",
    afterNone: "Nothing to switch off.",
  },
  tokenMint: {
    today: "An admin mints by hand, under the village's cap.",
    todayHeld: "The village already holds this power.",
    after: "The steward role and the Treasury role hold it. An admin in neither role can no longer mint by hand.",
    afterNobody: "Nobody would be in the steward role or the Treasury role, so nothing moves and an admin keeps minting by hand.",
  },
  handover: {
    todayNone: "No power is selected to cross at the launch.",
    today: (n, titles) => (n === 1 ? `One power is selected to cross at the launch: ${titles}.` : `${n} powers are selected to cross at the launch: ${titles}.`),
    after: "From the carry the village holds them. An admin no longer passes by being an admin: the stewards hold them, and a founder seated as a steward can reach past in an emergency, on the record.",
    afterNone: "Nothing crosses. Every power stays where it is until the stewards hand it over.",
  },
  keystone: {
    today: "One admin saves a keystone secret, and one admin rotates the signing key.",
    after: "A keystone secret saved by one admin waits for a second admin to co-sign. With no second admin it lands after a waiting period, unless a steward or a founder declines it. Rotating the signing key needs a second signer when two or more admins can sign in.",
  },
  currency: {
    today: (code) => `An admin can change it. It is ${code} today.`,
    todayNone: "No currency is set yet.",
    after: "It locks. Changing it takes a village vote at the highest tier.",
  },
  checklist: {
    today: "An admin answers its rows and can take an answer back.",
    after: "It becomes a record. No row can be answered or taken back.",
  },
  attention: {
    testFounder: (name, why, onRoll, yesNeeded) => {
      const reason = {
        example: "it is marked as an example account",
        agent: "it is an agent account",
        "qa-group": "it is in the QA viewers group",
        name: "its name carries a test word",
        address: "its address carries a test word",
      }[why];
      return onRoll
        ? `${name} holds the founder role and reads as a test account: ${reason}. It is on the launch roll, so its answer counts toward the ${yesNeeded} yeses the launch needs.`
        : `${name} holds the founder role and reads as a test account: ${reason}. It is not on the launch roll today.`;
    },
    rollShort: (on, need) => `${on} on the launch roll, and the vote needs ${need}. It cannot open yet.`,
    foundersAway: (names) => `${names}: holding the founder role and not on the launch roll, because the account has not signed in or has left.`,
    nobodyAccepted: "Nobody has accepted the steward role on the open vote. If it carries this way, nobody is seated, no power crosses, and an admin keeps the pay doors and hand minting.",
    seasonNoNext: "No next season is on the calendar. The launch begins the next season, so add one, with an end date, before the vote.",
    seasonNoEnd: (name) => `${name} has no end date. A steward role ends with its season, so nobody can be seated as a steward until it has one.`,
    adminsLose: (n, names) =>
      n === 1
        ? `One admin passes a door today that the carry closes to them, on what is known today: ${names}.`
        : `${n} admins pass a door today that the carry closes to them, on what is known today: ${names}.`,
  },
};

const ES: Words = {
  and: "y",
  nobody: "nadie",
  summary: {
    first: () => "Esta aldea no ha iniciado su Juego. Su votación de lanzamiento inicia la emisión y traspasa los poderes de la aldea, en una sola solicitud.",
    ratifying: (day) =>
      day
        ? `Esta aldea emite desde el ${day} y nunca ha celebrado su votación de lanzamiento. La votación deja el lanzamiento en acta y traspasa los poderes de la aldea. La emisión no se reinicia.`
        : "Esta aldea ya emitía antes de que existiera la votación de lanzamiento y nunca la ha celebrado. La votación deja el lanzamiento en acta y traspasa los poderes de la aldea. La emisión no se reinicia.",
    carried: (day) => (day ? `El lanzamiento se aprobó el ${day}. No queda nada por cambiar.` : "El lanzamiento ya se aprobó. No queda nada por cambiar."),
  },
  title: {
    issuance: "Emisión de tokens",
    "founder-powers": "Lo que solo puede hacer una persona fundadora",
    "vote-rules": "Las reglas de votación de la aldea",
    stewards: "Quién ocupa el rol de custodia",
    season: "La temporada",
    "moon-one": "Luna 1",
    "module-switch": "Activar un módulo",
    "org-publish": "Publicar el organigrama",
    pay: "Pago de misiones, pago de roles y presupuesto",
    "budget-sources": "Fuentes de presupuesto activadas por una administración",
    "token-mint": "Acuñar un token a mano",
    handover: "Poderes que el lanzamiento entrega a la aldea",
    keystone: "Secretos clave y la llave de firma",
    currency: "La moneda de la aldea",
    checklist: "El camino al lanzamiento",
  },
  nothingChanges: "Nada cambia.",
  issuance: {
    todayFirst: "No se puede emitir nada a nadie.",
    afterFirst: "La emisión se activa y se pagan las partes de Fin de Luna aprobadas antes de la votación.",
    todayIssuing: (day) => (day ? `La emisión está abierta desde el ${day}.` : "La emisión ya está abierta."),
  },
  founderPowers: {
    todayFirst: "Solo una persona fundadora cambia el acceso de una cuenta, y una persona fundadora comparte el control de traspaso con las personas custodias.",
    afterFirst: "Cualquier administración cambia el acceso de una cuenta, solo las personas custodias tienen el control de traspaso, y a nadie más se le puede dar el rol de fundación.",
    todayIssuing: "Esto terminó cuando empezó la emisión.",
  },
  voteRules: {
    todayFirst: "Una administración las fija en el panel.",
    afterFirst: "Se cierran al panel. Cada una cambia solo por una votación de la aldea en el nivel que requiere.",
    todayIssuing: "Se cerraron al panel cuando empezó la emisión.",
  },
  stewards: {
    todayNone: "Nadie ocupa el rol de custodia.",
    today: (names, n) => `${names} ${n === 1 ? "ocupa" : "ocupan"} hoy el rol de custodia.`,
    afterOpen: (named, accepted, until) =>
      `Quien fue nombrado en la votación abierta y acepta ocupa el rol de custodia, con todos los poderes que la aldea puede dar${until}. Nombrados: ${named}. Han aceptado hasta ahora: ${accepted}.`,
    afterNoVote: (until) =>
      `Quien la propuesta nombre y acepte ocupa el rol de custodia, con todos los poderes que la aldea puede dar${until}. La persona fundadora que abre la votación elige los nombres de la lista del lanzamiento.`,
    until: (day) => `, hasta el ${day}`,
    noTerm: (problem) => `Con el calendario de hoy nadie puede ocupar el rol de custodia. ${problem}`,
  },
  season: {
    today: (name) => `${name} está en curso.`,
    todayNone: "No hay ninguna temporada en curso.",
    turned: (to, from) =>
      from
        ? `${to} empieza ese día y releva a ${from}. Nada más se mueve en el calendario, y cada rol conserva la fecha de fin que se le dio.`
        : `${to} empieza ese día. Nada más se mueve en el calendario, y cada rol conserva la fecha de fin que se le dio.`,
    beganToday: (name) => `${name} empezó hoy, así que una aprobación hoy no inicia nada nuevo. Una aprobación en un día posterior inicia la temporada siguiente.`,
    noNext: "No hay una temporada siguiente en el calendario, así que la temporada no cambia.",
  },
  moon: {
    today: "La aldea aún no cuenta sus lunas.",
    todayByHand: "La Luna 1 está fijada a mano en los ajustes de la aldea.",
    after: "La Luna 1 es la luna en la que cae la aprobación. Los periodos de pago siguen las lunas como siempre, y ninguno se mueve.",
    afterByHand: "El ajuste sigue decidiendo la Luna 1. Los periodos de pago no se mueven.",
  },
  moduleSwitch: {
    today: "Cualquier administración activa un módulo.",
    after: "Quien tiene el poder de activar módulos lo hace, o la aldea por votación. Una administración aún puede pausar un módulo o apagarlo.",
  },
  orgPublish: {
    today: "Cualquier administración publica un cambio en el organigrama.",
    after: "Quien tiene el poder de decidir el organigrama lo publica, o el cambio va a una votación de la aldea.",
  },
  pay: {
    today: "Una administración fija lo que pagan una misión y un rol, y lleva el presupuesto.",
    after: "Cuando alguien ocupe el rol de custodia, solo lo hará quien tenga el poder de pago. Mientras el rol de custodia esté vacío, una administración aún puede.",
  },
  sources: {
    todayNone: "Ninguna fuente de presupuesto está activa por decisión de una administración.",
    today: (n, names) => (n === 1 ? `Una fuente de presupuesto está activa por decisión de una administración: ${names}.` : `${n} fuentes de presupuesto están activas por decisión de una administración: ${names}.`),
    after: "Cuando alguien ocupe el rol de custodia, cada una deja de adoptar líneas por sí sola. Su siguiente importación espera revisión hasta que quien tenga el poder de pago la active de nuevo.",
    afterNone: "No hay nada que apagar.",
  },
  tokenMint: {
    today: "Una administración acuña a mano, dentro del tope de la aldea.",
    todayHeld: "La aldea ya tiene este poder.",
    after: "Lo tienen el rol de custodia y el rol de Tesorería. Una administración que no esté en ninguno de los dos ya no puede acuñar a mano.",
    afterNobody: "No habría nadie en el rol de custodia ni en el de Tesorería, así que nada se mueve y una administración sigue acuñando a mano.",
  },
  handover: {
    todayNone: "No hay ningún poder seleccionado para traspasarse en el lanzamiento.",
    today: (n, titles) => (n === 1 ? `Un poder está seleccionado para traspasarse en el lanzamiento: ${titles}.` : `${n} poderes están seleccionados para traspasarse en el lanzamiento: ${titles}.`),
    after: "Desde la aprobación los tiene la aldea. Una administración ya no pasa solo por serlo: los tienen las personas custodias, y una persona fundadora que ocupe el rol de custodia puede intervenir en una emergencia, y queda en acta.",
    afterNone: "Nada se traspasa. Cada poder se queda donde está hasta que las personas custodias lo entreguen.",
  },
  keystone: {
    today: "Una administración guarda un secreto clave, y una administración rota la llave de firma.",
    after: "Un secreto clave guardado por una administración espera a que una segunda lo cofirme. Si no hay una segunda, entra tras un periodo de espera, salvo que una persona custodia o fundadora lo rechace. Rotar la llave de firma requiere una segunda firma cuando dos o más administraciones pueden iniciar sesión.",
  },
  currency: {
    today: (code) => `Una administración puede cambiarla. Hoy es ${code}.`,
    todayNone: "Aún no hay una moneda fijada.",
    after: "Se bloquea. Cambiarla requiere una votación de la aldea en el nivel más alto.",
  },
  checklist: {
    today: "Una administración responde sus filas y puede retirar una respuesta.",
    after: "Se convierte en un registro. Ninguna fila puede responderse ni retirarse.",
  },
  attention: {
    testFounder: (name, why, onRoll, yesNeeded) => {
      const reason = {
        example: "está marcada como cuenta de ejemplo",
        agent: "es una cuenta de agente",
        "qa-group": "está en el grupo de observación de QA",
        name: "su nombre lleva una palabra de prueba",
        address: "su dirección lleva una palabra de prueba",
      }[why];
      return onRoll
        ? `${name} tiene el rol de fundación y parece una cuenta de prueba: ${reason}. Está en la lista del lanzamiento, así que su respuesta cuenta para los ${yesNeeded} síes que el lanzamiento necesita.`
        : `${name} tiene el rol de fundación y parece una cuenta de prueba: ${reason}. Hoy no está en la lista del lanzamiento.`;
    },
    rollShort: (on, need) => `${on} en la lista del lanzamiento, y la votación necesita ${need}. Aún no puede abrirse.`,
    foundersAway: (names) => `${names}: con el rol de fundación y fuera de la lista del lanzamiento, porque la cuenta no ha iniciado sesión o se ha ido.`,
    nobodyAccepted: "Nadie ha aceptado el rol de custodia en la votación abierta. Si se aprueba así, nadie lo ocupa, ningún poder se traspasa, y una administración conserva las puertas de pago y la acuñación a mano.",
    seasonNoNext: "No hay una temporada siguiente en el calendario. El lanzamiento inicia la temporada siguiente, así que añada una, con fecha de fin, antes de la votación.",
    seasonNoEnd: (name) => `${name} no tiene fecha de fin. Un rol de custodia termina con su temporada, así que nadie puede ocuparlo hasta que la tenga.`,
    adminsLose: (n, names) =>
      n === 1
        ? `Una administración pasa hoy una puerta que la aprobación le cierra, según lo que se sabe hoy: ${names}.`
        : `${n} administraciones pasan hoy una puerta que la aprobación les cierra, según lo que se sabe hoy: ${names}.`,
  },
};

const WORDS: Record<CarryLang, Words> = { en: EN, es: ES };

/** The language a caller asked for: Spanish for any `es` tag, English otherwise. */
export function carryLangFrom(raw: unknown): CarryLang {
  return String(raw ?? "").trim().toLowerCase().startsWith("es") ? "es" : "en";
}

// ── The list ────────────────────────────────────────────────────────────────

const day = (iso: string | null): string => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : "");

/**
 * What changes when the launch vote carries, from today's facts.
 *
 * PURE. Every input is a fact the route read; nothing here reaches for a
 * clock or a database, so each case is a unit test.
 */
export function launchCarryChanges(facts: CarryFacts, lang: CarryLang = "en"): CarryChanges {
  const w = WORDS[lang];
  const people = (ids: readonly string[]): Person[] => ids.map((id) => ({ id, name: facts.nameOf(id) }));
  const names = (ps: readonly Person[]) => list(ps.map((p) => p.name), w.and, w.nobody);

  if (facts.kind === "carried") {
    return {
      kind: "carried",
      issuingSince: facts.issuingSince,
      launchedAt: facts.launchedAt,
      summary: w.summary.carried(day(facts.launchedAt)),
      changes: [],
      admins: facts.admins.map((a) => ({ ...a, loses: [] })),
      attention: [],
    };
  }

  /*
   * WHO WILL HOLD THE STEWARD ROLE, as far as today knows: whoever holds it
   * already, plus whoever the open vote named and who has accepted. With no
   * vote open nobody is named, so only today's holders count. The steward role
   * carries every power the launch moves, so this set keeps every door below.
   */
  const acceptedIds = facts.slate ? facts.slate.accepted.filter((id) => !facts.slate!.declined.includes(id)) : [];
  const expectedStewards = Array.from(new Set([...(facts.stewardTerm.problem ? [] : acceptedIds), ...facts.holders.steward]));
  const somebodySeated = expectedStewards.length > 0;
  const keeps = (holders: readonly string[]) => new Set([...holders, ...expectedStewards]);
  const losing = (pass: readonly AdminAccount[], kept: Set<string>): Person[] =>
    pass.filter((a) => !kept.has(a.id)).map((a) => ({ id: a.id, name: a.name }));
  const byRole = facts.admins.filter((a) => a.viaRole);

  const first = facts.kind === "first";
  const issuingDay = day(facts.issuingSince);
  const changes: CarryChange[] = [];
  const add = (id: CarryChangeId, standing: CarryStanding, today: string, after: string, holds: Person[] = [], loses: Person[] = []) =>
    changes.push({ id, standing, title: w.title[id], today, after, holds, loses });

  // ── What hangs off issuance: flips for a new village, already true for one that is issuing ──
  add("issuance", first ? "flips" : "already", first ? w.issuance.todayFirst : w.issuance.todayIssuing(issuingDay), first ? w.issuance.afterFirst : w.nothingChanges);
  add("founder-powers", first ? "flips" : "already", first ? w.founderPowers.todayFirst : w.founderPowers.todayIssuing, first ? w.founderPowers.afterFirst : w.nothingChanges);
  add("vote-rules", first ? "flips" : "already", first ? w.voteRules.todayFirst : w.voteRules.todayIssuing, first ? w.voteRules.afterFirst : w.nothingChanges);

  // ── The steward role ──
  const until = facts.stewardTerm.endsOn ? w.stewards.until(facts.stewardTerm.endsOn) : "";
  const stewardsToday = facts.holders.steward.length ? w.stewards.today(names(people(facts.holders.steward)), facts.holders.steward.length) : w.stewards.todayNone;
  const stewardsAfter = facts.stewardTerm.problem
    ? w.stewards.noTerm(facts.stewardTerm.problem)
    : facts.slate
      ? w.stewards.afterOpen(names(facts.slate.named), names(people(acceptedIds)), until)
      : w.stewards.afterNoVote(until);
  add("stewards", facts.stewardTerm.problem ? "nothing" : "flips", stewardsToday, stewardsAfter, people(expectedStewards));

  // ── The season and the moon ──
  const turn = facts.season;
  if (turn.turned) {
    add("season", "flips", turn.from ? w.season.today(turn.from.name) : w.season.todayNone, w.season.turned(turn.to.name, turn.from?.name ?? null));
  } else if (turn.reason === "began_that_day") {
    add("season", "nothing", w.season.today(turn.running?.name ?? ""), w.season.beganToday(turn.running?.name ?? ""));
  } else {
    add("season", "nothing", turn.running ? w.season.today(turn.running.name) : w.season.todayNone, w.season.noNext);
  }
  add("moon-one", facts.moonSetByHand ? "nothing" : "flips", facts.moonSetByHand ? w.moon.todayByHand : w.moon.today, facts.moonSetByHand ? w.moon.afterByHand : w.moon.after);

  // ── The doors that pass to whoever holds the power ──
  const switchKeeps = keeps(facts.holders.moduleSwitch);
  add("module-switch", "flips", w.moduleSwitch.today, w.moduleSwitch.after, people(Array.from(switchKeeps)), losing(facts.admins, switchKeeps));
  const orgKeeps = keeps(facts.holders.orgDecide);
  add("org-publish", "flips", w.orgPublish.today, w.orgPublish.after, people(Array.from(orgKeeps)), losing(facts.admins, orgKeeps));

  // Pay and the budget pass only once somebody is seated as a steward (holderDoor).
  const payKeeps = keeps(facts.holders.pay);
  add("pay", somebodySeated ? "flips" : "nothing", w.pay.today, w.pay.after, people(Array.from(payKeeps)), somebodySeated ? losing(byRole, payKeeps) : []);
  add(
    "budget-sources",
    facts.adminSources.length && somebodySeated ? "flips" : "nothing",
    facts.adminSources.length ? w.sources.today(facts.adminSources.length, list(facts.adminSources, w.and, w.nobody)) : w.sources.todayNone,
    facts.adminSources.length ? w.sources.after : w.sources.afterNone,
  );

  // token.mint crosses only when the steward role or the Treasury role has somebody in it.
  const mintMoves = !facts.tokenMint.alreadyHeld && (somebodySeated || facts.tokenMint.rolesWithSomebody);
  const mintKeeps = new Set([...facts.holders.tokenMint, ...expectedStewards, ...facts.tokenMint.treasury.map((p) => p.id)]);
  add(
    "token-mint",
    facts.tokenMint.alreadyHeld ? "already" : mintMoves ? "flips" : "nothing",
    facts.tokenMint.alreadyHeld ? w.tokenMint.todayHeld : w.tokenMint.today,
    facts.tokenMint.alreadyHeld ? w.nothingChanges : mintMoves ? w.tokenMint.after : w.tokenMint.afterNobody,
    people(Array.from(mintKeeps)),
    mintMoves ? losing(byRole, mintKeeps) : [],
  );

  // The stewards' selection crosses only when somebody holds the steward role.
  const crosses = facts.handover.length > 0 && somebodySeated;
  add(
    "handover",
    crosses ? "flips" : "nothing",
    facts.handover.length ? w.handover.today(facts.handover.length, list(facts.handover, w.and, w.nobody)) : w.handover.todayNone,
    facts.handover.length ? w.handover.after : w.handover.afterNone,
    crosses ? people(expectedStewards) : [],
    crosses ? losing(byRole, new Set(expectedStewards)) : [],
  );

  // ── The doors that change for every administrator alike ──
  add("keystone", "flips", w.keystone.today, w.keystone.after);
  add("currency", facts.currency ? "flips" : "nothing", facts.currency ? w.currency.today(facts.currency) : w.currency.todayNone, w.currency.after);
  add("checklist", "flips", w.checklist.today, w.checklist.after);

  // ── Each administrator, with the doors they would lose ──
  const admins = facts.admins.map((a) => ({
    ...a,
    loses: changes.filter((c) => c.loses.some((p) => p.id === a.id)).map((c) => c.id),
  }));

  // ── What a person should look at before the vote ──
  const attention: CarryAttention[] = [];
  const onRoll = new Set(facts.roll.onIt.map((p) => p.id));
  for (const t of facts.testFounders) {
    attention.push({
      id: "test-founder",
      // On the roll whichever roll the village chose: a founder is a member too, so a village that asks every member asks this account.
      text: w.attention.testFounder(t.name, t.why, onRoll.has(t.id), facts.roll.yesNeeded),
      accounts: [{ id: t.id, name: t.name }],
    });
  }
  if (facts.roll.onIt.length < facts.roll.yesNeeded) {
    attention.push({ id: "roll-short", text: w.attention.rollShort(facts.roll.onIt.length, facts.roll.yesNeeded), accounts: facts.roll.onIt });
  }
  if (facts.roll.notOnIt.length) {
    const away = facts.roll.notOnIt.map((p) => ({ id: p.id, name: p.name }));
    attention.push({ id: "founders-away", text: w.attention.foundersAway(names(away)), accounts: away });
  }
  if (facts.slate && !somebodySeated && !facts.stewardTerm.problem) {
    attention.push({ id: "nobody-accepted", text: w.attention.nobodyAccepted, accounts: facts.slate.named });
  }
  if (!turn.turned && turn.reason === "no_next_season") {
    attention.push({ id: "season", text: w.attention.seasonNoNext, accounts: [] });
  } else if (turn.turned && !turn.to.endsOn) {
    attention.push({ id: "season", text: w.attention.seasonNoEnd(turn.to.name), accounts: [] });
  }
  const losers = admins.filter((a) => a.loses.length > 0).map((a) => ({ id: a.id, name: a.name }));
  if (losers.length) {
    attention.push({ id: "admins-lose", text: w.attention.adminsLose(losers.length, names(losers)), accounts: losers });
  }

  return {
    kind: facts.kind,
    issuingSince: facts.issuingSince,
    launchedAt: facts.launchedAt,
    summary: w.summary[facts.kind](issuingDay),
    changes,
    admins,
    attention,
  };
}
