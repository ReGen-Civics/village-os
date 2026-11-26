/**
 * THE MOON RECAP'S WORDS IN THE READER'S LANGUAGE: the mirror of the tables in shared/moonRecap.ts that the client
 * draws (My moon, the review queue, Admin's end of moon, the invoices desk, their states and refusals), gathered
 * as `MOON_RECAP_WORDS` so one mirror covers them.
 *
 * The shared tables stay English for the server, which writes notices and emails from some of them. The pages
 * draw this mirror through `useMoonWords()` (or `moonWords()` outside a component). Typed off the shared tables, so
 * a key added there and not here fails the compiler; moonWords.test.ts holds the English equal and every entry to
 * the catalog.
 */
// A value import of the runtime: precompileEnglish compiles the messages of a file that imports it and skips one
// that only uses `msg` (client/src/components/roleCard/payBandWords.ts says the same).
import { i18n as appI18n, type I18n } from "@lingui/core";
import { msg, plural } from "@lingui/core/macro";
import { ROLE_PAY_CAP_PCT } from "@shared/rolePayMath";
import { ADMIN_WORDS, AUTHORITY_KIND_WORDS, CARRY_FLAG_WORDS, GOAL_STATUS_WORDS, GUIDE_WORDS, INVOICE_STATUS_WORDS, ITEM_KEEP_WORDS, ITEM_ORIGIN_WORDS, ITEM_STATE_WORDS, ITEM_VISIBILITY_WORDS, LET_GO_NEEDS_REASON, LINE_BASIS_WORDS, MOON_WORDS, MY_MOON_WORDS, PACK_REFUSAL_WORDS, PACK_SKIP_WORDS, PACK_WORDS, PAY_ROUTE_SHORT_WORDS, QUEUE_STAGE_WORDS, QUEUE_WORDS, RECAP_STATUS_WORDS, ROLE_AUDIT_WORDS, SELF_APPROVED_WORDS, SERA_STATE_WORDS, SPLIT_PAY_WORDS, TASK_STATUS_WORDS, THANKS_WORDS } from "@shared/moonRecap";
import { drawWords, useWords, type Drawn, type WordMirror } from "@/i18n/wordTable";

/** The client-drawn moon recap tables, by the name each is drawn under. */
export const MOON_RECAP_WORDS = {
  myMoon: MY_MOON_WORDS,
  admin: ADMIN_WORDS,
  moon: MOON_WORDS,
  queue: QUEUE_WORDS,
  invoiceStatus: INVOICE_STATUS_WORDS,
  itemOrigin: ITEM_ORIGIN_WORDS,
  itemState: ITEM_STATE_WORDS,
  itemVisibility: ITEM_VISIBILITY_WORDS,
  taskStatus: TASK_STATUS_WORDS,
  roleAudit: ROLE_AUDIT_WORDS,
  lineBasis: LINE_BASIS_WORDS,
  splitPay: SPLIT_PAY_WORDS,
  selfApproved: SELF_APPROVED_WORDS,
  guide: GUIDE_WORDS,
  thanks: THANKS_WORDS,
  goalStatus: GOAL_STATUS_WORDS,
  carryFlag: CARRY_FLAG_WORDS,
  packRefusal: PACK_REFUSAL_WORDS,
  packSkip: PACK_SKIP_WORDS,
  pack: PACK_WORDS,
  seraState: SERA_STATE_WORDS,
  queueStage: QUEUE_STAGE_WORDS,
  itemKeep: ITEM_KEEP_WORDS,
  payRouteShort: PAY_ROUTE_SHORT_WORDS,
  authorityKind: AUTHORITY_KIND_WORDS,
  recapStatus: RECAP_STATUS_WORDS,
  letGoNeedsReason: LET_GO_NEEDS_REASON,
};

export type MoonWords = Drawn<typeof MOON_RECAP_WORDS>;

export const MOON_RECAP_MIRROR: WordMirror<typeof MOON_RECAP_WORDS> = {
  myMoon: {
    loading: msg({ message: "Reading your moon.", context: "moon recap: MY_MOON_WORDS: loading" }),
    failed: msg({ message: "That did not go through. Try again in a moment.", context: "moon recap: MY_MOON_WORDS: failed" }),
    notOn: msg({ message: "The end-of-moon review is not open on this village.", context: "moon recap: MY_MOON_WORDS: notOn" }),
    signIn: msg({ message: "Sign in to read your moon.", context: "moon recap: MY_MOON_WORDS: signIn" }),
    whichMoon: msg({ message: "Which moon", context: "moon recap: MY_MOON_WORDS: whichMoon" }),
    walkthrough: msg({ message: "Walkthrough day", context: "moon recap: MY_MOON_WORDS: walkthrough" }),
    moonLoad: msg({ message: "Moon load", context: "moon recap: MY_MOON_WORDS: moonLoad" }),
    moonLoadOf: (n) => msg({ message: `${n} of 5`, context: "moon recap: MY_MOON_WORDS: moonLoadOf" }),
    notStarted: msg({ message: "Not started yet. Bring in your tasks to begin.", context: "moon recap: MY_MOON_WORDS: notStarted" }),
    roomViewOn: msg({ message: "Room view is on", context: "moon recap: MY_MOON_WORDS: roomViewOn" }),
    roomViewOff: msg({ message: "Room view is off", context: "moon recap: MY_MOON_WORDS: roomViewOff" }),
    gatherHeading: msg({ message: "Gather", context: "moon recap: MY_MOON_WORDS: gatherHeading" }),
    gathered: (n) =>
      n === 0
        ? msg({ message: "Nothing new to bring in.", context: "moon recap: MY_MOON_WORDS: gathered" })
        : msg({ message: plural(n, { one: "# item brought in.", other: "# items brought in." }), context: "moon recap: MY_MOON_WORDS: gathered" }),
    askSeraNotOffered: msg({ message: "Ask Sera is not open on this village yet. Bring in your tasks, or import from Claude.", context: "moon recap: MY_MOON_WORDS: askSeraNotOffered" }),
    seraAdded: (n) => msg({ message: plural(n, { one: "# suggestion so far.", other: "# suggestions so far." }), context: "moon recap: MY_MOON_WORDS: seraAdded" }),
    pastePack: msg({ message: "Paste the moon pack Claude gave you", context: "moon recap: MY_MOON_WORDS: pastePack" }),
    cancel: msg({ message: "Cancel", context: "moon recap: MY_MOON_WORDS: cancel" }),
    imported: (added, merged, skipped) => msg({ message: `Imported: ${added} added, ${merged} merged, ${skipped} skipped.`, context: "moon recap: MY_MOON_WORDS: imported" }),
    skippedItem: (index) => {
      const n = index + 1;
      return msg({ message: `Item ${n}`, context: "moon recap: MY_MOON_WORDS: skippedItem" });
    },
    keepAndTag: msg({ message: "Keep and tag", context: "moon recap: MY_MOON_WORDS: keepAndTag" }),
    noItems: msg({ message: "No items yet. Bring in your tasks, import from Claude, or add one by hand.", context: "moon recap: MY_MOON_WORDS: noItems" }),
    newItemPlaceholder: msg({ message: "What did you deliver?", context: "moon recap: MY_MOON_WORDS: newItemPlaceholder" }),
    itemWords: msg({ message: "What was delivered", context: "moon recap: MY_MOON_WORDS: itemWords" }),
    howItEnded: msg({ message: "How it ended", context: "moon recap: MY_MOON_WORDS: howItEnded" }),
    letGoReason: msg({ message: "Why it was let go", context: "moon recap: MY_MOON_WORDS: letGoReason" }),
    redirectTo: msg({ message: "Who or which role it belongs to", context: "moon recap: MY_MOON_WORDS: redirectTo" }),
    role: msg({ message: "Role", context: "moon recap: MY_MOON_WORDS: role" }),
    belongsTo: msg({ message: "The role it belongs to", context: "moon recap: MY_MOON_WORDS: belongsTo" }),
    accountability: msg({ message: "Accountability or deliverable", context: "moon recap: MY_MOON_WORDS: accountability" }),
    none: msg({ message: "None", context: "moon recap: MY_MOON_WORDS: none" }),
    seasonGoal: msg({ message: "Season goal", context: "moon recap: MY_MOON_WORDS: seasonGoal" }),
    ownGoal: msg({ message: "My seasonal goal", context: "moon recap: MY_MOON_WORDS: ownGoal" }),
    whoSees: msg({ message: "Who sees it", context: "moon recap: MY_MOON_WORDS: whoSees" }),
    proofLink: msg({ message: "Proof link, optional", context: "moon recap: MY_MOON_WORDS: proofLink" }),
    save: msg({ message: "Save", context: "moon recap: MY_MOON_WORDS: save" }),
    saving: msg({ message: "Saving.", context: "moon recap: MY_MOON_WORDS: saving" }),
    saved: msg({ message: "Saved.", context: "moon recap: MY_MOON_WORDS: saved" }),
    noLines: msg({ message: "This role card lists no accountabilities yet.", context: "moon recap: MY_MOON_WORDS: noLines" }),
    quiet: msg({ message: "Quiet this moon", context: "moon recap: MY_MOON_WORDS: quiet" }),
    noOutside: msg({ message: "Nothing outside your roles this moon.", context: "moon recap: MY_MOON_WORDS: noOutside" }),
    scoreHeading: msg({ message: "The score", context: "moon recap: MY_MOON_WORDS: scoreHeading" }),
    taskScore: msg({ message: "Task score", context: "moon recap: MY_MOON_WORDS: taskScore" }),
    roleCoverage: msg({ message: "Role coverage", context: "moon recap: MY_MOON_WORDS: roleCoverage" }),
    onlyYou: msg({ message: "Only you see these numbers. They never set pay and are never ranked.", context: "moon recap: MY_MOON_WORDS: onlyYou" }),
    auditNote: msg({ message: "A note", context: "moon recap: MY_MOON_WORDS: auditNote" }),
    auditPrefilled: msg({ message: "From Outside my roles", context: "moon recap: MY_MOON_WORDS: auditPrefilled" }),
    addNewRole: msg({ message: "Add a role that should exist", context: "moon recap: MY_MOON_WORDS: addNewRole" }),
    newRoleName: msg({ message: "The role's name", context: "moon recap: MY_MOON_WORDS: newRoleName" }),
    newRoleWhy: msg({ message: "Why it should exist", context: "moon recap: MY_MOON_WORDS: newRoleWhy" }),
    lastGoals: msg({ message: "Last moon's goals", context: "moon recap: MY_MOON_WORDS: lastGoals" }),
    nextGoals: msg({ message: "Next moon's goals", context: "moon recap: MY_MOON_WORDS: nextGoals" }),
    nextGoalsLine: msg({ message: "Set three to five. Carried goals come first.", context: "moon recap: MY_MOON_WORDS: nextGoalsLine" }),
    goalText: msg({ message: "The goal", context: "moon recap: MY_MOON_WORDS: goalText" }),
    doneWhen: msg({ message: "Done when", context: "moon recap: MY_MOON_WORDS: doneWhen" }),
    addGoal: msg({ message: "Add a goal", context: "moon recap: MY_MOON_WORDS: addGoal" }),
    remove: msg({ message: "Remove", context: "moon recap: MY_MOON_WORDS: remove" }),
    saveGoals: msg({ message: "Save the goals", context: "moon recap: MY_MOON_WORDS: saveGoals" }),
    carriedTimes: (n) => msg({ message: plural(n, { one: "Carried once", other: "Carried # times" }), context: "moon recap: MY_MOON_WORDS: carriedTimes" }),
    goalScoreLine: msg({ message: "Goal score", context: "moon recap: MY_MOON_WORDS: goalScoreLine" }),
    thanksFind: msg({ message: "Find a member, or type a name", context: "moon recap: MY_MOON_WORDS: thanksFind" }),
    thanksNote: msg({ message: "What they did, optional", context: "moon recap: MY_MOON_WORDS: thanksNote" }),
    thanksAdd: msg({ message: "Add", context: "moon recap: MY_MOON_WORDS: thanksAdd" }),
    thanksSavedOnSend: msg({ message: "Saved with your recap when you send it.", context: "moon recap: MY_MOON_WORDS: thanksSavedOnSend" }),
    ownWordsHint: msg({ message: "A short note for the room.", context: "moon recap: MY_MOON_WORDS: ownWordsHint" }),
    sent: msg({ message: "Sent.", context: "moon recap: MY_MOON_WORDS: sent" }),
    routeHeading: msg({ message: "Your pay route", context: "moon recap: MY_MOON_WORDS: routeHeading" }),
    routeChoice: msg({ message: "Where you live and work, and your status", context: "moon recap: MY_MOON_WORDS: routeChoice" }),
    legalName: msg({ message: "Your legal name (private: only you, the Treasurer and admins see it, and it never goes to Sera)", context: "moon recap: MY_MOON_WORDS: legalName" }),
    address: msg({ message: "Your address", context: "moon recap: MY_MOON_WORDS: address" }),
    currency: msg({ message: "Currency", context: "moon recap: MY_MOON_WORDS: currency" }),
    statusValidUntil: msg({ message: "My status is valid until", context: "moon recap: MY_MOON_WORDS: statusValidUntil" }),
    taxForm: msg({ message: "Tax form", context: "moon recap: MY_MOON_WORDS: taxForm" }),
    taxFormNone: msg({ message: "None", context: "moon recap: MY_MOON_WORDS: taxFormNone" }),
    taxFormSignedOn: msg({ message: "Tax form signed on", context: "moon recap: MY_MOON_WORDS: taxFormSignedOn" }),
    taxFormExpiresOn: msg({ message: "Tax form expires on", context: "moon recap: MY_MOON_WORDS: taxFormExpiresOn" }),
    saveRoute: msg({ message: "Save my pay route", context: "moon recap: MY_MOON_WORDS: saveRoute" }),
    routeSaved: msg({ message: "Saved. Another person holding the cash power confirms it.", context: "moon recap: MY_MOON_WORDS: routeSaved" }),
    routeConfirmed: msg({ message: "Confirmed by Finance", context: "moon recap: MY_MOON_WORDS: routeConfirmed" }),
    routeNotConfirmed: msg({ message: "Not confirmed yet", context: "moon recap: MY_MOON_WORDS: routeNotConfirmed" }),
    pilotHeading: msg({ message: "The pilot note", context: "moon recap: MY_MOON_WORDS: pilotHeading" }),
    pilotAccept: msg({ message: "I have read this and accept it", context: "moon recap: MY_MOON_WORDS: pilotAccept" }),
    noPayerYet: msg({ message: "No payer pays your route yet.", context: "moon recap: MY_MOON_WORDS: noPayerYet" }),
    basis: msg({ message: "Basis", context: "moon recap: MY_MOON_WORDS: basis" }),
    proposeAmount: msg({ message: "The amount you propose, in minor units", context: "moon recap: MY_MOON_WORDS: proposeAmount" }),
    countriesHint: msg({ message: "Two-letter codes, separated by commas", context: "moon recap: MY_MOON_WORDS: countriesHint" }),
    hiddenInRoom: msg({ message: "Hidden in Room view", context: "moon recap: MY_MOON_WORDS: hiddenInRoom" }),
    copy: msg({ message: "Copy", context: "moon recap: MY_MOON_WORDS: copy" }),
    copied: msg({ message: "Copied.", context: "moon recap: MY_MOON_WORDS: copied" }),
    invoiceAfterApproval: msg({ message: "Your work summary is ready once both approvals are in.", context: "moon recap: MY_MOON_WORDS: invoiceAfterApproval" }),
  }
  ,
  admin: {
    heading: msg({ message: "End-of-moon review settings", context: "moon recap: ADMIN_WORDS: heading" }),
    intro: msg({ message: "Who the village pays and how, the host country's words and rates, and the moon's days. Every value here is the village's own, and each change is recorded with its old and new value.", context: "moon recap: ADMIN_WORDS: intro" }),
    tabs: {
      payers: msg({ message: "Payers", context: "moon recap: ADMIN_WORDS: tabs.payers" }),
      settings: msg({ message: "Village settings", context: "moon recap: ADMIN_WORDS: tabs.settings" }),
      rhythm: msg({ message: "Moon rhythm", context: "moon recap: ADMIN_WORDS: tabs.rhythm" }),
    },
    save: msg({ message: "Save", context: "moon recap: ADMIN_WORDS: save" }),
    saving: msg({ message: "Saving", context: "moon recap: ADMIN_WORDS: saving" }),
    saved: (n) =>
      n === 0
        ? msg({ message: "Nothing changed.", context: "moon recap: ADMIN_WORDS: saved" })
        : msg({ message: plural(n, { one: "Saved. # change recorded.", other: "Saved. # changes recorded." }), context: "moon recap: ADMIN_WORDS: saved" }),
    loadFailed: msg({ message: "These settings did not load. Try again in a moment.", context: "moon recap: ADMIN_WORDS: loadFailed" }),
    noKey: msg({ message: "These settings need the cash power, and this account does not hold it.", context: "moon recap: ADMIN_WORDS: noKey" }),
    payers: {
      empty: msg({ message: "Name who you pay first. Until a payer has invoicing on and the routes it pays, members can send their recap and no invoice.", context: "moon recap: ADMIN_WORDS: payers.empty" }),
      add: msg({ message: "Add a payer", context: "moon recap: ADMIN_WORDS: payers.add" }),
      newPayer: msg({ message: "A new payer", context: "moon recap: ADMIN_WORDS: payers.newPayer" }),
      remove: msg({ message: "Remove this payer", context: "moon recap: ADMIN_WORDS: payers.remove" }),
      key: msg({ message: "Short key (lowercase, used in bill refs)", context: "moon recap: ADMIN_WORDS: payers.key" }),
      legalName: msg({ message: "Legal name", context: "moon recap: ADMIN_WORDS: payers.legalName" }),
      address: msg({ message: "Address", context: "moon recap: ADMIN_WORDS: payers.address" }),
      taxId: msg({ message: "Tax number", context: "moon recap: ADMIN_WORDS: payers.taxId" }),
      country: msg({ message: "Country (two-letter code)", context: "moon recap: ADMIN_WORDS: payers.country" }),
      currencies: msg({ message: "Currencies it pays in (three-letter codes, comma separated)", context: "moon recap: ADMIN_WORDS: payers.currencies" }),
      invoiceTo: msg({ message: "Where invoices go", context: "moon recap: ADMIN_WORDS: payers.invoiceTo" }),
      invoiceCc: msg({ message: "Copy invoices to (email addresses, comma separated, up to 5)", context: "moon recap: ADMIN_WORDS: payers.invoiceCc" }),
      invoicing: msg({ message: "Invoicing is on for this payer", context: "moon recap: ADMIN_WORDS: payers.invoicing" }),
      routes: msg({ message: "The routes it pays", context: "moon recap: ADMIN_WORDS: payers.routes" }),
      authority: msg({ message: "Authority, kept as a note", context: "moon recap: ADMIN_WORDS: payers.authority" }),
      authorityKind: msg({ message: "Kind", context: "moon recap: ADMIN_WORDS: payers.authorityKind" }),
      authorityDate: msg({ message: "Date", context: "moon recap: ADMIN_WORDS: payers.authorityDate" }),
      ceiling: msg({ message: "Monthly ceiling, in minor units", context: "moon recap: ADMIN_WORDS: payers.ceiling" }),
      ceilingCurrency: msg({ message: "Ceiling currency", context: "moon recap: ADMIN_WORDS: payers.ceilingCurrency" }),
      filedWhere: msg({ message: "Where it is filed", context: "moon recap: ADMIN_WORDS: payers.filedWhere" }),
      queueNote: msg({ message: "A note Finance reads beside each invoice", context: "moon recap: ADMIN_WORDS: payers.queueNote" }),
    },
    settings: {
      hostCode: msg({ message: "Host country code (two letters)", context: "moon recap: ADMIN_WORDS: settings.hostCode" }),
      hostName: msg({ message: "Host country name", context: "moon recap: ADMIN_WORDS: settings.hostName" }),
      hostMissing: msg({ message: "Name the host country. The route and attestation words say \"the host country\" until you do.", context: "moon recap: ADMIN_WORDS: settings.hostMissing" }),
      vat: msg({ message: "VAT rate, as a percent", context: "moon recap: ADMIN_WORDS: settings.vat" }),
      rateSource: msg({ message: "Where the exchange rate comes from", context: "moon recap: ADMIN_WORDS: settings.rateSource" }),
      seraInbox: msg({ message: "Sera's inbox (email address)", context: "moon recap: ADMIN_WORDS: settings.seraInbox" }),
      seraInboxHint: msg({ message: "A sent invoice is emailed here with its PDF. Leave it empty to send nothing. While two or more people hold cash.pay or the steward veto, a new address waits for a second of them to confirm it, and every member is told the new address.", context: "moon recap: ADMIN_WORDS: settings.seraInboxHint" }),
      seraInboxPending: (address) => msg({ message: `A new Sera inbox is waiting for a second holder to confirm it: ${address}. Until then invoices still go to the current one.`, context: "moon recap: ADMIN_WORDS: settings.seraInboxPending" }),
      seraInboxConfirm: msg({ message: "Confirm the new inbox", context: "moon recap: ADMIN_WORDS: settings.seraInboxConfirm" }),
      seraInboxCancel: msg({ message: "Cancel the change", context: "moon recap: ADMIN_WORDS: settings.seraInboxCancel" }),
      seraInboxConfirmed: msg({ message: "The new Sera inbox is in place, and every member has been told.", context: "moon recap: ADMIN_WORDS: settings.seraInboxConfirmed" }),
      seraInboxCancelled: msg({ message: "The change to Sera's inbox was cancelled.", context: "moon recap: ADMIN_WORDS: settings.seraInboxCancelled" }),
      currency: msg({ message: "Host currency (three-letter code)", context: "moon recap: ADMIN_WORDS: settings.currency" }),
      ackText: msg({ message: "Pilot acknowledgement", context: "moon recap: ADMIN_WORDS: settings.ackText" }),
      ackVersion: msg({ message: "Its version", context: "moon recap: ADMIN_WORDS: settings.ackVersion" }),
      ackMissing: msg({ message: "Write the pilot acknowledgement and its version. A new version asks every member to accept again.", context: "moon recap: ADMIN_WORDS: settings.ackMissing" }),
      taxForms: msg({ message: "Tax forms kept on file", context: "moon recap: ADMIN_WORDS: settings.taxForms" }),
      addForm: msg({ message: "Add a tax form", context: "moon recap: ADMIN_WORDS: settings.addForm" }),
      formKey: msg({ message: "Key (up to 8 letters, digits or dashes)", context: "moon recap: ADMIN_WORDS: settings.formKey" }),
      formLabel: msg({ message: "Name members read", context: "moon recap: ADMIN_WORDS: settings.formLabel" }),
      formRoutes: msg({ message: "Routes that need a valid tax form", context: "moon recap: ADMIN_WORDS: settings.formRoutes" }),
      holds: msg({ message: "Holds: invoices Finance decides with the accountant", context: "moon recap: ADMIN_WORDS: settings.holds" }),
      addHold: msg({ message: "Add a hold", context: "moon recap: ADMIN_WORDS: settings.addHold" }),
      holdForm: msg({ message: "Tax form", context: "moon recap: ADMIN_WORDS: settings.holdForm" }),
      holdCountry: msg({ message: "Work done in (two-letter code)", context: "moon recap: ADMIN_WORDS: settings.holdCountry" }),
      holdNote: msg({ message: "Note", context: "moon recap: ADMIN_WORDS: settings.holdNote" }),
      remove: msg({ message: "Remove", context: "moon recap: ADMIN_WORDS: settings.remove" }),
    },
    rhythm: {
      sendHour: msg({ message: "Hour reminders go out, village time (0 to 23)", context: "moon recap: ADMIN_WORDS: rhythm.sendHour" }),
      guideUrl: msg({ message: "The village's End of Moon guide (https link)", context: "moon recap: ADMIN_WORDS: rhythm.guideUrl" }),
      guideEmpty: msg({ message: "With no guide set, no guide link shows anywhere.", context: "moon recap: ADMIN_WORDS: rhythm.guideEmpty" }),
      overrides: msg({ message: "Moved days", context: "moon recap: ADMIN_WORDS: rhythm.overrides" }),
      overridesHint: msg({ message: "Move one moon's walkthrough or circle day, for a holiday or another meeting day. Leave a day empty to keep the usual one.", context: "moon recap: ADMIN_WORDS: rhythm.overridesHint" }),
      addOverride: msg({ message: "Move a moon's days", context: "moon recap: ADMIN_WORDS: rhythm.addOverride" }),
      cycleId: msg({ message: "Moon (cycle id)", context: "moon recap: ADMIN_WORDS: rhythm.cycleId" }),
      walkthrough: msg({ message: "Walkthrough day", context: "moon recap: ADMIN_WORDS: rhythm.walkthrough" }),
      circle: msg({ message: "Circle day", context: "moon recap: ADMIN_WORDS: rhythm.circle" }),
      remove: msg({ message: "Remove", context: "moon recap: ADMIN_WORDS: rhythm.remove" }),
    },
  }
  ,
  moon: {
    heading: msg({ message: "My moon", context: "moon recap: MOON_WORDS: heading" }),
    thisMoon: msg({ message: "This moon", context: "moon recap: MOON_WORDS: thisMoon" }),
    roomView: msg({ message: "Room view", context: "moon recap: MOON_WORDS: roomView" }),
    roomViewLine: msg({ message: "Every amount is hidden while Room view is on.", context: "moon recap: MOON_WORDS: roomViewLine" }),
    gather: msg({ message: "Bring in my tasks", context: "moon recap: MOON_WORDS: gather" }),
    askSera: msg({ message: "Ask Sera", context: "moon recap: MOON_WORDS: askSera" }),
    addItem: msg({ message: "Add an item", context: "moon recap: MOON_WORDS: addItem" }),
    keep: msg({ message: "Keep", context: "moon recap: MOON_WORDS: keep" }),
    drop: msg({ message: "Drop", context: "moon recap: MOON_WORDS: drop" }),
    againstMyCards: msg({ message: "Against my role cards", context: "moon recap: MOON_WORDS: againstMyCards" }),
    seasonGoals: msg({ message: "Season goals", context: "moon recap: MOON_WORDS: seasonGoals" }),
    myGoals: msg({ message: "My seasonal goals", context: "moon recap: MOON_WORDS: myGoals" }),
    roleAudit: msg({ message: "Role audit", context: "moon recap: MOON_WORDS: roleAudit" }),
    newRole: msg({ message: "A role that should exist", context: "moon recap: MOON_WORDS: newRole" }),
    ownWords: msg({ message: "In my own words", context: "moon recap: MOON_WORDS: ownWords" }),
    sendRecap: msg({ message: "Send my recap", context: "moon recap: MOON_WORDS: sendRecap" }),
    sendRecapLine: msg({ message: "Your recap sends without a pay route.", context: "moon recap: MOON_WORDS: sendRecapLine" }),
    invoice: msg({ message: "Invoice", context: "moon recap: MOON_WORDS: invoice" }),
    sendInvoice: msg({ message: "Send draft invoice for approval", context: "moon recap: MOON_WORDS: sendInvoice" }),
    takeBack: msg({ message: "Take back", context: "moon recap: MOON_WORDS: takeBack" }),
    takeBackLine: msg({ message: "Back to Draft. Any approval given is cleared.", context: "moon recap: MOON_WORDS: takeBackLine" }),
    billTo: msg({ message: "Bill to", context: "moon recap: MOON_WORDS: billTo" }),
    from: msg({ message: "From", context: "moon recap: MOON_WORDS: from" }),
    period: msg({ message: "Period", context: "moon recap: MOON_WORDS: period" }),
    total: msg({ message: "Total", context: "moon recap: MOON_WORDS: total" }),
    attestation: msg({ message: "This moon's attestation", context: "moon recap: MOON_WORDS: attestation" }),
    paymentDetails: msg({ message: "Payment goes to the account you have on file with Finance.", context: "moon recap: MOON_WORDS: paymentDetails" }),
    whoReads: msg({ message: "Who can read your pay details", context: "moon recap: MOON_WORDS: whoReads" }),
    memberNumber: msg({ message: "Your invoice number", context: "moon recap: MOON_WORDS: memberNumber" }),
    externalKey: msg({ message: "Electronic invoice key", context: "moon recap: MOON_WORDS: externalKey" }),
    copySummary: msg({ message: "Copy work summary", context: "moon recap: MOON_WORDS: copySummary" }),
    copyEmail: msg({ message: "Copy for email", context: "moon recap: MOON_WORDS: copyEmail" }),
    printable: msg({ message: "Open printable invoice", context: "moon recap: MOON_WORDS: printable" }),
    noRecapRoles: msg({ message: "You held no role this moon, so there is nothing to recap.", context: "moon recap: MOON_WORDS: noRecapRoles" }),
    prepareBy: msg({ message: "Prepare by", context: "moon recap: MOON_WORDS: prepareBy" }),
    sendBy: msg({ message: "Send by", context: "moon recap: MOON_WORDS: sendBy" }),
    to: msg({ message: "To", context: "moon recap: MOON_WORDS: to" }),
    cc: msg({ message: "Cc", context: "moon recap: MOON_WORDS: cc" }),
    acceptRange: msg({ message: "Accept", context: "moon recap: MOON_WORDS: acceptRange" }),
    talkRange: msg({ message: "Ask to talk", context: "moon recap: MOON_WORDS: talkRange" }),
  }
  ,
  queue: {
    heading: msg({ message: "Moon reviews", context: "moon recap: QUEUE_WORDS: heading" }),
    invoicesView: msg({ message: "Invoices", context: "moon recap: QUEUE_WORDS: invoicesView" }),
    loading: msg({ message: "Reading the invoices.", context: "moon recap: QUEUE_WORDS: loading" }),
    empty: msg({ message: "Nothing is waiting on you this moon.", context: "moon recap: QUEUE_WORDS: empty" }),
    rolesWithNoItems: msg({ message: "Roles with no items this moon", context: "moon recap: QUEUE_WORDS: rolesWithNoItems" }),
    outside: (n) => msg({ message: plural(n, { one: "# item outside their roles", other: "# items outside their roles" }), context: "moon recap: QUEUE_WORDS: outside" }),
    open: msg({ message: "Open", context: "moon recap: QUEUE_WORDS: open" }),
    close: msg({ message: "Close", context: "moon recap: QUEUE_WORDS: close" }),
    approve: msg({ message: "Approve", context: "moon recap: QUEUE_WORDS: approve" }),
    approveWork: msg({ message: "Approve the work", context: "moon recap: QUEUE_WORDS: approveWork" }),
    returnIt: msg({ message: "Return with a note", context: "moon recap: QUEUE_WORDS: returnIt" }),
    note: msg({ message: "The note", context: "moon recap: QUEUE_WORDS: note" }),
    approveSelected: msg({ message: "Approve selected", context: "moon recap: QUEUE_WORDS: approveSelected" }),
    selectAll: msg({ message: "Select every invoice", context: "moon recap: QUEUE_WORDS: selectAll" }),
    expectedOn: msg({ message: "Expected payment date", context: "moon recap: QUEUE_WORDS: expectedOn" }),
    result: (approved, refused, held) => msg({ message: `${approved} approved, ${refused} refused, ${held} held.`, context: "moon recap: QUEUE_WORDS: result" }),
    noEligible: msg({ message: "Nobody else can give this approval. The core circle names a stand-in.", context: "moon recap: QUEUE_WORDS: noEligible" }),
    noItemsInQueue: msg({ message: "The queue did not send this recap's items, so it opens from the member's profile.", context: "moon recap: QUEUE_WORDS: noItemsInQueue" }),
    routeCheck: msg({ message: "Route check", context: "moon recap: QUEUE_WORDS: routeCheck" }),
    taxFormValid: msg({ message: "Tax form valid on the expected date", context: "moon recap: QUEUE_WORDS: taxFormValid" }),
    taxFormMissing: msg({ message: "Tax form not valid on the expected date", context: "moon recap: QUEUE_WORDS: taxFormMissing" }),
    authority: msg({ message: "Payer authority", context: "moon recap: QUEUE_WORDS: authority" }),
    approvers: (names) => {
      if (names.length === 0) return msg({ message: "Nobody can approve this yet.", context: "moon recap: QUEUE_WORDS: approvers" });
      const who = names.join(", ");
      return msg({ message: `Can approve: ${who}`, context: "moon recap: QUEUE_WORDS: approvers" });
    },
  }
  ,
  invoiceStatus: {
    draft: msg({ message: "Draft", context: "moon recap: INVOICE_STATUS_WORDS: draft" }),
    waiting: msg({ message: "Waiting on approval", context: "moon recap: INVOICE_STATUS_WORDS: waiting" }),
    returned: msg({ message: "Returned with a note", context: "moon recap: INVOICE_STATUS_WORDS: returned" }),
    approved: msg({ message: "Approved, waiting to be paid", context: "moon recap: INVOICE_STATUS_WORDS: approved" }),
    paid: msg({ message: "Paid", context: "moon recap: INVOICE_STATUS_WORDS: paid" }),
    void: msg({ message: "Void", context: "moon recap: INVOICE_STATUS_WORDS: void" }),
  }
  ,
  itemOrigin: {
    task: msg({ message: "From my list", context: "moon recap: ITEM_ORIGIN_WORDS: task" }),
    room: msg({ message: "From a room", context: "moon recap: ITEM_ORIGIN_WORDS: room" }),
    sera: msg({ message: "From Sera", context: "moon recap: ITEM_ORIGIN_WORDS: sera" }),
    hand: msg({ message: "Added by hand", context: "moon recap: ITEM_ORIGIN_WORDS: hand" }),
    carry: msg({ message: "Carried from last moon", context: "moon recap: ITEM_ORIGIN_WORDS: carry" }),
    claude: msg({ message: "From the deep dive", context: "moon recap: ITEM_ORIGIN_WORDS: claude" }),
  }
  ,
  itemState: {
    suggested: msg({ message: "Suggested", context: "moon recap: ITEM_STATE_WORDS: suggested" }),
    kept: msg({ message: "Kept", context: "moon recap: ITEM_STATE_WORDS: kept" }),
    dropped: msg({ message: "Dropped", context: "moon recap: ITEM_STATE_WORDS: dropped" }),
  }
  ,
  itemVisibility: {
    members: msg({ message: "Members", context: "moon recap: ITEM_VISIBILITY_WORDS: members" }),
    approvers: msg({ message: "Approvers only", context: "moon recap: ITEM_VISIBILITY_WORDS: approvers" }),
  }
  ,
  taskStatus: {
    done: msg({ message: "Done", context: "moon recap: TASK_STATUS_WORDS: done" }),
    partly: msg({ message: "Partly", context: "moon recap: TASK_STATUS_WORDS: partly" }),
    carry: msg({ message: "Carry", context: "moon recap: TASK_STATUS_WORDS: carry" }),
    let_go: msg({ message: "Let go", context: "moon recap: TASK_STATUS_WORDS: let_go" }),
    redirect: msg({ message: "Redirect", context: "moon recap: TASK_STATUS_WORDS: redirect" }),
  }
  ,
  roleAudit: {
    keep: msg({ message: "Keep", context: "moon recap: ROLE_AUDIT_WORDS: keep" }),
    expand: msg({ message: "Expand", context: "moon recap: ROLE_AUDIT_WORDS: expand" }),
    contract: msg({ message: "Contract", context: "moon recap: ROLE_AUDIT_WORDS: contract" }),
    hand_back: msg({ message: "Hand back", context: "moon recap: ROLE_AUDIT_WORDS: hand_back" }),
    fill: msg({ message: "Fill", context: "moon recap: ROLE_AUDIT_WORDS: fill" }),
  }
  ,
  lineBasis: {
    per_moon: msg({ message: "Fixed per moon", context: "moon recap: LINE_BASIS_WORDS: per_moon" }),
    per_month: msg({ message: "Fixed per month, prorated by days", context: "moon recap: LINE_BASIS_WORDS: per_month" }),
    range: msg({ message: "A range", context: "moon recap: LINE_BASIS_WORDS: range" }),
    allowance: msg({ message: "Allowance", context: "moon recap: LINE_BASIS_WORDS: allowance" }),
    listed: msg({ message: "Listed, no cash", context: "moon recap: LINE_BASIS_WORDS: listed" }),
  }
  ,
  splitPay: {
    basis: (givenPct, pricedPct) => msg({ message: `Your split gives this ${givenPct}% of your time, and it was priced at ${pricedPct}%`, context: "moon recap: SPLIT_PAY_WORDS: basis" }),
    base: msg({ message: "Before the split", context: "moon recap: SPLIT_PAY_WORDS: base" }),
    share: msg({ message: "Share of time", context: "moon recap: SPLIT_PAY_WORDS: share" }),
    given: msg({ message: "Your time given to it", context: "moon recap: SPLIT_PAY_WORDS: given" }),
    priced: msg({ message: "Priced at", context: "moon recap: SPLIT_PAY_WORDS: priced" }),
    capped: msg({ message: `Capped at ${ROLE_PAY_CAP_PCT}%`, context: "moon recap: SPLIT_PAY_WORDS: capped" }),
    cappedNote: msg({ message: `The split gave this role more time than it was priced at, so it pays ${ROLE_PAY_CAP_PCT}% of its terms, the most a role pays.`, context: "moon recap: SPLIT_PAY_WORDS: cappedNote" }),
    scaled: msg({ message: "After the split", context: "moon recap: SPLIT_PAY_WORDS: scaled" }),
    weighted: (n) => msg({ message: `weighted by the days each of your ${n} splits held this moon`, context: "moon recap: SPLIT_PAY_WORDS: weighted" }),
    periodLine: (fromDay, days, givenPct) =>
      givenPct === null
        ? msg({ message: `From ${fromDay}, ${days} days at the terms`, context: "moon recap: SPLIT_PAY_WORDS: periodLine" })
        : msg({ message: `From ${fromDay}, ${days} days at ${givenPct}%`, context: "moon recap: SPLIT_PAY_WORDS: periodLine" }),
    waiting: msg({ message: "A Treasurer confirms the split before this is paid.", context: "moon recap: SPLIT_PAY_WORDS: waiting" }),
    confirmed: msg({ message: "The split is confirmed.", context: "moon recap: SPLIT_PAY_WORDS: confirmed" }),
    confirm: msg({ message: "Confirm the split", context: "moon recap: SPLIT_PAY_WORDS: confirm" }),
    confirmHint: msg({ message: "These lines are scaled by the member's own split of their time. Check each amount, then confirm before you approve.", context: "moon recap: SPLIT_PAY_WORDS: confirmHint" }),
  }
  ,
  selfApproved: msg({ message: "Approved by the member themselves", context: "moon recap: SELF_APPROVED_WORDS" })
  ,
  guide: {
    open: msg({ message: "Open the End of Moon guide", context: "moon recap: GUIDE_WORDS: open" }),
  }
  ,
  thanks: {
    heading: msg({ message: "Who helped you this moon?", context: "moon recap: THANKS_WORDS: heading" }),
    sendGratitude: msg({ message: "Send gratitude", context: "moon recap: THANKS_WORDS: sendGratitude" }), // village-ok: mirrors THANKS_WORDS word for word; the shared table is the source
    notice: (name) => msg({ message: `${name} thanked you in their moon recap.`, context: "moon recap: THANKS_WORDS: notice" }),
  }
  ,
  goalStatus: {
    open: msg({ message: "Open", context: "moon recap: GOAL_STATUS_WORDS: open" }),
    done: msg({ message: "Done", context: "moon recap: GOAL_STATUS_WORDS: done" }),
    partly: msg({ message: "Partly", context: "moon recap: GOAL_STATUS_WORDS: partly" }),
    carried: msg({ message: "Carry", context: "moon recap: GOAL_STATUS_WORDS: carried" }),
    let_go: msg({ message: "Let go", context: "moon recap: GOAL_STATUS_WORDS: let_go" }),
  }
  ,
  carryFlag: msg({ message: "Carried twice. Do it, reshape it, hand it on, or let it go.", context: "moon recap: CARRY_FLAG_WORDS" })
  ,
  packRefusal: {
    not_a_pack: msg({ message: "This is not a moon pack. Paste the whole pack the deep dive gave you.", context: "moon recap: PACK_REFUSAL_WORDS: not_a_pack" }),
    too_big: msg({ message: "This pack is over 200 KB. Ask for a shorter one.", context: "moon recap: PACK_REFUSAL_WORDS: too_big" }),
    too_many_items: msg({ message: "A pack holds 300 items at most.", context: "moon recap: PACK_REFUSAL_WORDS: too_many_items" }),
    too_many_goals: msg({ message: "A pack sets five next-moon goals at most.", context: "moon recap: PACK_REFUSAL_WORDS: too_many_goals" }),
    moon_mismatch: msg({ message: "This pack is for another moon. Its start and end dates do not match this one.", context: "moon recap: PACK_REFUSAL_WORDS: moon_mismatch" }),
    forbidden_key: msg({ message: "A moon pack never carries amounts, pay, rates or tax. Ask for the pack again without them.", context: "moon recap: PACK_REFUSAL_WORDS: forbidden_key" }),
    unknown_key: msg({ message: "This pack has a field the moon pack does not have. Ask for the pack again.", context: "moon recap: PACK_REFUSAL_WORDS: unknown_key" }),
    invalid: msg({ message: "Part of this pack is not in the moon pack's shape.", context: "moon recap: PACK_REFUSAL_WORDS: invalid" }),
  }
  ,
  packSkip: {
    seat_unknown: msg({ message: "Names a role you do not hold", context: "moon recap: PACK_SKIP_WORDS: seat_unknown" }),
    goal_unknown: msg({ message: "Names a season goal this season does not have", context: "moon recap: PACK_SKIP_WORDS: goal_unknown" }),
    outside_moon: msg({ message: "Its date is outside this moon", context: "moon recap: PACK_SKIP_WORDS: outside_moon" }),
    duplicate: msg({ message: "Already on your recap", context: "moon recap: PACK_SKIP_WORDS: duplicate" }),
  }
  ,
  pack: {
    button: msg({ message: "Import from Claude", context: "moon recap: PACK_WORDS: button" }),
    preview: msg({ message: "Preview", context: "moon recap: PACK_WORDS: preview" }),
    confirm: msg({ message: "Import", context: "moon recap: PACK_WORDS: confirm" }),
    added: (n) => msg({ message: `${n} to add`, context: "moon recap: PACK_WORDS: added" }),
    merged: (n) => msg({ message: `${n} to merge with items already here`, context: "moon recap: PACK_WORDS: merged" }),
    skipped: (n) => msg({ message: `${n} to skip`, context: "moon recap: PACK_WORDS: skipped" }),
  }
  ,
  seraState: {
    idle: msg({ message: "Sera has not drafted this moon yet.", context: "moon recap: SERA_STATE_WORDS: idle" }),
    running: msg({ message: "Sera is drafting your moon.", context: "moon recap: SERA_STATE_WORDS: running" }),
    done: msg({ message: "Sera's suggestions are below. They stay private to you until you keep them.", context: "moon recap: SERA_STATE_WORDS: done" }),
    failed: msg({ message: "Sera did not answer in time. Whatever arrived is below; add the rest by hand.", context: "moon recap: SERA_STATE_WORDS: failed" }),
    not_linked: msg({ message: "Your Sera record is not linked yet. Add your items by hand.", context: "moon recap: SERA_STATE_WORDS: not_linked" }),
  }
  ,
  queueStage: {
    work: msg({ message: "The work", context: "moon recap: QUEUE_STAGE_WORDS: work" }),
    invoice: msg({ message: "The invoice", context: "moon recap: QUEUE_STAGE_WORDS: invoice" }),
  }
  ,
  itemKeep: {
    kept: msg({ message: "Keep", context: "moon recap: ITEM_KEEP_WORDS: kept" }),
    dropped: msg({ message: "Drop", context: "moon recap: ITEM_KEEP_WORDS: dropped" }),
  }
  ,
  payRouteShort: {
    pending: msg({ message: "Not chosen yet", context: "moon recap: PAY_ROUTE_SHORT_WORDS: pending" }),
    abroad: msg({ message: "Lives and works abroad", context: "moon recap: PAY_ROUTE_SHORT_WORDS: abroad" }),
    nomad: msg({ message: "Digital nomad", context: "moon recap: PAY_ROUTE_SHORT_WORDS: nomad" }),
    local_contractor: msg({ message: "Local contractor", context: "moon recap: PAY_ROUTE_SHORT_WORDS: local_contractor" }),
    local_employee: msg({ message: "Local employee", context: "moon recap: PAY_ROUTE_SHORT_WORDS: local_employee" }),
    visitor: msg({ message: "Visitor, or status pending", context: "moon recap: PAY_ROUTE_SHORT_WORDS: visitor" }),
  }
  ,
  authorityKind: {
    none: msg({ message: "None recorded", context: "moon recap: AUTHORITY_KIND_WORDS: none" }),
    bridge_agreement: msg({ message: "Bridge agreement", context: "moon recap: AUTHORITY_KIND_WORDS: bridge_agreement" }),
    written_authorization: msg({ message: "Written authorization", context: "moon recap: AUTHORITY_KIND_WORDS: written_authorization" }),
  }
  ,
  recapStatus: {
    draft: msg({ message: "Draft", context: "moon recap: RECAP_STATUS_WORDS: draft" }),
    waiting: msg({ message: "Waiting on approval", context: "moon recap: RECAP_STATUS_WORDS: waiting" }),
    returned: msg({ message: "Returned with a note", context: "moon recap: RECAP_STATUS_WORDS: returned" }),
    approved: msg({ message: "Approved", context: "moon recap: RECAP_STATUS_WORDS: approved" }),
  }
  ,
  letGoNeedsReason: msg({ message: "Say why it was let go, in a few words.", context: "moon recap: LET_GO_NEEDS_REASON" }),
};

let last: { i18n: I18n; locale: string; messages: unknown; words: MoonWords } | null = null;

/** The recap's words in `i18n`'s language, for a helper outside a component. Drawn once per language. */
export function moonWords(i18n: I18n = appI18n): MoonWords {
  if (last && last.i18n === i18n && last.locale === i18n.locale && last.messages === i18n.messages) return last.words;
  const words = drawWords(MOON_RECAP_MIRROR, i18n);
  last = { i18n, locale: i18n.locale, messages: i18n.messages, words };
  return words;
}

/** The recap's words in the reader's language. */
export function useMoonWords(): MoonWords {
  return useWords(MOON_RECAP_MIRROR);
}
