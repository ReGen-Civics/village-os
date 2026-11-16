import { describe, expect, it } from "vitest";
import { pickBrowserVoice, type VoiceLike } from "./pickBrowserVoice";

const v = (name: string, lang: string, localService = true): VoiceLike => ({
  name,
  lang,
  localService,
});

describe("pickBrowserVoice", () => {
  it("returns null for no voices or no voice in the language", () => {
    expect(pickBrowserVoice([], "en")).toBeNull();
    expect(pickBrowserVoice(null, "en")).toBeNull();
    expect(pickBrowserVoice(undefined, "es")).toBeNull();
    expect(
      pickBrowserVoice(
        [
          v(
            "Microsoft Ava Online (Natural) - English (United States)",
            "en-US"
          ),
        ],
        "es"
      )
    ).toBeNull();
  });

  it("puts Natural and Neural names above Windows David and Zira", () => {
    const voices = [
      v("Microsoft David - English (United States)", "en-US"),
      v("Microsoft Zira - English (United States)", "en-US"),
      v(
        "Microsoft Ava Online (Natural) - English (United States)",
        "en-US",
        false
      ),
    ];
    expect(pickBrowserVoice(voices, "en")?.name).toBe(
      "Microsoft Ava Online (Natural) - English (United States)"
    );
  });

  it("ranks Natural, then Premium or Enhanced, then Google, then other local voices", () => {
    const local = v("Samantha", "en-US");
    const google = v("Google US English", "en-US", false);
    const premium = v("Ava (Premium)", "en-US");
    const enhanced = v("Zoe (Enhanced)", "en-US");
    const natural = v("Microsoft Jenny Online (Natural)", "en-US", false);
    const neural = v("en-US-AriaNeural (Neural)", "en-US", false);
    expect(pickBrowserVoice([local, google, premium, natural], "en")).toBe(
      natural
    );
    expect(pickBrowserVoice([local, google, neural], "en")).toBe(neural);
    expect(pickBrowserVoice([local, google, premium], "en")).toBe(premium);
    expect(pickBrowserVoice([local, google, enhanced], "en")).toBe(enhanced);
    expect(pickBrowserVoice([local, google], "en")).toBe(google);
    expect(
      pickBrowserVoice([v("Other Remote", "en-US", false), local], "en")
    ).toBe(local);
  });

  it("uses a robotic default only when nothing else speaks the language", () => {
    const david = v("Microsoft David Desktop", "en-US");
    const espeak = v("eSpeak English", "en");
    expect(
      pickBrowserVoice([david, espeak, v("Daniel", "en-GB")], "en")?.name
    ).toBe("Daniel");
    expect(pickBrowserVoice([david], "en")).toBe(david);
  });

  it("never chooses a novelty voice, even as the only one", () => {
    const novelty = [
      "Albert",
      "Bad News",
      "Bells",
      "Bubbles",
      "Cellos",
      "Zarvox",
      "Whisper",
      "Trinoids",
      "Good News",
      "Jester",
    ].map(n => v(n, "en-US"));
    expect(pickBrowserVoice(novelty, "en")).toBeNull();
    expect(
      pickBrowserVoice([...novelty, v("Samantha", "en-US")], "en")?.name
    ).toBe("Samantha");
  });

  it("language match beats name rank: a Spanish page never gets an English voice", () => {
    const voices = [
      v("Microsoft Ava Online (Natural)", "en-US", false),
      v("Microsoft Sabina - Spanish (Mexico)", "es-MX"),
    ];
    expect(pickBrowserVoice(voices, "es")?.lang).toBe("es-MX");
    expect(pickBrowserVoice(voices, "en")?.lang).toBe("en-US");
  });

  it("prefers es-CR, then es-MX, es-US, es-419 for Spanish inside one tier", () => {
    const spain = v("Google español", "es-ES", false);
    const us = v("Google español de Estados Unidos", "es-US", false);
    const mx = v("Google español de México", "es-MX", false);
    const cr = v("Google español de Costa Rica", "es-CR", false);
    const latam = v("Google español latino", "es-419", false);
    expect(pickBrowserVoice([spain, us, mx, cr, latam], "es")).toBe(cr);
    expect(pickBrowserVoice([spain, us, mx, latam], "es")).toBe(mx);
    expect(pickBrowserVoice([spain, latam, us], "es")).toBe(us);
    expect(pickBrowserVoice([spain, latam], "es")).toBe(latam);
    expect(pickBrowserVoice([spain], "es")).toBe(spain);
  });

  it("a Costa Rican voice always wins on a Spanish page, even over a natural one", () => {
    const natural = v(
      "Microsoft Dalia Online (Natural) - Spanish (Mexico)",
      "es-MX",
      false
    );
    const plainCr = v("Google español de Costa Rica", "es-CR", false);
    expect(pickBrowserVoice([natural, plainCr], "es")).toBe(plainCr);
    expect(pickBrowserVoice([natural, plainCr], "es-MX")).toBe(plainCr);
    const naturalCr = v("Microsoft Maria Online (Natural) - Spanish (Costa Rica)", "es-CR", false);
    expect(pickBrowserVoice([plainCr, naturalCr, natural], "es")).toBe(naturalCr);
  });

  it("outside Costa Rica, a natural voice beats a robotic one from a preferred region", () => {
    const natural = v("Microsoft Paloma Online (Natural) - Spanish (United States)", "es-US", false);
    const robotic = v("eSpeak Spanish", "es-MX");
    expect(pickBrowserVoice([robotic, natural], "es")).toBe(natural);
  });

  it("an exact page region wins inside a tier, and underscores read as hyphens", () => {
    const voices = [v("Paulina", "es_MX"), v("Monica", "es_ES")];
    expect(pickBrowserVoice(voices, "es-ES")?.name).toBe("Monica");
    expect(pickBrowserVoice(voices, "es")?.name).toBe("Paulina");
  });

  it("a bare English page prefers US, then UK; an empty language reads as English", () => {
    const voices = [
      v("Karen", "en-AU"),
      v("Daniel", "en-GB"),
      v("Samantha", "en-US"),
    ];
    expect(pickBrowserVoice(voices, "en")?.name).toBe("Samantha");
    expect(pickBrowserVoice(voices.slice(0, 2), "en")?.name).toBe("Daniel");
    expect(pickBrowserVoice(voices, "")?.name).toBe("Samantha");
    expect(pickBrowserVoice(voices, null)?.name).toBe("Samantha");
  });

  it("keeps the list order as the last tie-break", () => {
    const a = v("Samantha", "en-US");
    const b = v("Alex", "en-US");
    expect(pickBrowserVoice([a, b], "en")).toBe(a);
    expect(pickBrowserVoice([b, a], "en")).toBe(b);
  });
});
