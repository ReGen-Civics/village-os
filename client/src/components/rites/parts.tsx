/**
 * The rites screens' shared pieces, drawn to the approved onboarding design
 * (components.css ported to ./rites.css). Every word arrives from the server
 * as the village's own; every colour from the village's look or the platform's
 * night world. Shapes only here.
 */
import { useMemo, type CSSProperties, type ReactNode } from "react";
import { Link } from "wouter";
import { encodeQr, qrPath } from "@shared/qr";
import { lookStyle, MARK_PATH_SHAPE, type NavItem, type PlaceKey, type StampView } from "@shared/rites";
import "./rites.css";

export type Look = Record<string, string>;
export type Places = Partial<Record<PlaceKey, string>>;

/** The scope every rites screen draws inside. */
export function RitesWorld({ look, children, lang }: { look?: Look | null; children: ReactNode; lang?: ReactNode }) {
  const style = useMemo(() => lookStyle(look ?? {}) as CSSProperties, [look]);
  return (
    <div className="rites sheet-night" style={style}>
      {children}
      {/* The language selector, at the foot so the screen's own top stays the village's (pickerCoverage.test.ts). */}
      {lang ? <div className="langbar noprint">{lang}</div> : null}
    </div>
  );
}

const ICONS: Record<string, ReactNode> = {
  seed: <ellipse cx="12" cy="15" rx="5" ry="4" fill="currentColor" />,
  sprout: (
    <g fill="currentColor">
      <ellipse cx="12" cy="19" rx="4.5" ry="2.6" opacity=".55" />
      <path d="M11.2 18V11h1.6v7z" />
      <path d="M12 12c-.6-3.6-3.4-5.6-7-5.6 0 3.6 3 5.6 7 5.6zM12 10.5c.6-4 3.6-6.3 7.6-6.3 0 4-3.4 6.3-7.6 6.3z" />
    </g>
  ),
  vehicle: (
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M2 16V7.5A1.5 1.5 0 0 1 3.5 6h13.2c1 0 1.9.6 2.3 1.5L22 13v3H2z" /> {/* village-ok: an SVG path command, not a unit */}
      <path d="M5 9h4v3H5zM12 9h4v3h-4z" />
      <circle cx="7" cy="17.5" r="2" fill="currentColor" />
      <circle cx="17" cy="17.5" r="2" fill="currentColor" />
    </g>
  ),
  quests: (
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a3 3 0 0 1-3-3V6" />
      <path d="M4 6a2 2 0 1 1 4 0v11M10 9h6M10 13h6" />
    </g>
  ),
  map: (
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" />
      <path d="M9 4v14M15 6v14" />
    </g>
  ),
  fleet: (
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M5 20V4l7 3-7 3M13 20V8l6 2.6-6 2.6" />
      <path d="M3 20h18" />
    </g>
  ),
  card: (
    <g fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <circle cx="9" cy="11" r="2.3" />
      <path d="M5.8 16.5c.6-1.8 1.8-2.6 3.2-2.6s2.6.8 3.2 2.6M14.5 10h4M14.5 13.5h3" />
    </g>
  ),
  home: (
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
    </g>
  ),
  lock: (
    <g fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="5" y="10.5" width="14" height="10" rx="2" fill="currentColor" fillOpacity=".15" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </g>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />,
};

export function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[name] ?? ICONS.seed}
    </svg>
  );
}

/** The village's sigil, or a plain ring when it has none. */
export function Sigil({ src, className = "sigil" }: { src?: string | null; className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      {src ? (
        // Drawn as a mask, so the mark takes the colour around it: gold on the bar, the seal's ink on wax.
        <span style={{ display: "block", width: "100%", height: "100%", background: "currentColor", WebkitMask: `url("${src.replace(/"/g, "")}") center / contain no-repeat`, mask: `url("${src.replace(/"/g, "")}") center / contain no-repeat` }} />
      ) : (
        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="32" cy="32" r="27" />
          <circle cx="32" cy="32" r="6" fill="currentColor" stroke="none" />
        </svg>
      )}
    </div>
  );
}

export function TopBar({ sigil, name, children }: { sigil?: string | null; name: string; children?: ReactNode }) {
  return (
    <div className="topbar">
      <Sigil src={sigil} />
      <div className="name">{name}</div>
      <div className="sp" />
      {children}
    </div>
  );
}

export function Chip({ place, places, extra }: { place: PlaceKey | null | undefined; places: Places; extra?: string }) {
  if (!place || !places[place]) return null;
  return (
    <span className={`chip ${place}`}>
      <i />
      {places[place]}
      {extra ? ` · ${extra}` : ""}
    </span>
  );
}

export function MarkSvg({ path, width = 4 }: { path: string | null | undefined; width?: number }) {
  if (!path || !MARK_PATH_SHAPE.test(path)) return null;
  return (
    <svg viewBox="0 0 60 60" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

export function Avatar({ name, src, tone = "", large = false }: { name: string; src?: string | null; tone?: "" | "g" | "b"; large?: boolean }) {
  return (
    <div className={`av ${tone} ${large ? "lg" : ""}`.trim()} aria-hidden="true">
      {src ? <img src={src} alt="" /> : (name.trim()[0] ?? "?").toUpperCase()}
    </div>
  );
}

export function Stamps({ stamps, fresh = [] }: { stamps: StampView[]; fresh?: string[] }) {
  return (
    <div className="stamps">
      {stamps.map((s) => (
        <div key={s.id} className={`stamp ${s.state === "on" ? `on${s.ink === "alt" ? " g" : ""}` : s.state === "next" ? "next" : ""}${fresh.includes(s.id) ? " new" : ""}`}>
          {s.label}
        </div>
      ))}
    </div>
  );
}

export interface CardProps {
  name: string;
  stageWord: string;
  mark: string | null;
  markHint?: ReactNode;
  meta?: ReactNode;
  stamps: StampView[];
  fresh?: string[];
  numbers?: Array<{ n: number; name: string }>;
  numbersFirst?: boolean;
  foot?: ReactNode;
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

/** The member's card: mark, stage, name, the two numbers, the stamps. */
export function MemberCard({ name, stageWord, mark, markHint, meta, stamps, fresh, numbers = [], numbersFirst = false, foot }: CardProps) {
  const nums = numbers.length ? (
    <div className="meta">
      {numbers.map((x) => (
        <div key={x.name}>
          <b>{fmt(x.n)}</b>
          <span>{x.name}</span>
        </div>
      ))}
    </div>
  ) : null;
  return (
    <div className="parch pcard">
      <div className="row">
        <div className={`mark${mark ? " made" : ""}`}>{mark ? <MarkSvg path={mark} width={5} /> : markHint}</div>
        <div>
          <p className="stage">{stageWord}</p>
          <p className="nm">{name}</p>
          {meta ? <p className="small muted" style={{ marginTop: 4 }}>{meta}</p> : null}
        </div>
      </div>
      {numbersFirst ? nums : null}
      {stamps.length ? (
        <div style={{ marginTop: 16 }}>
          <Stamps stamps={stamps} fresh={fresh} />
        </div>
      ) : null}
      {numbersFirst ? null : nums}
      {foot}
    </div>
  );
}

/** The ring of marks around the village's agreement. No mark leads. */
export function Ring({ marks, centre, sigil }: { marks: Array<{ path: string; mine: boolean }>; centre: ReactNode; sigil?: string | null }) {
  const n = Math.max(marks.length, 1);
  return (
    <div className="markring">
      <div className="c">
        <Sigil src={sigil} className="s" />
        {centre}
      </div>
      {marks.map((m, i) => {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        return (
          <div key={i} className={`m${m.mine ? " new" : ""}`} style={{ left: 150 + 128 * Math.cos(a), top: 150 + 128 * Math.sin(a) }}>
            <MarkSvg path={m.path} width={m.mine ? 5 : 4} />
          </div>
        );
      })}
    </div>
  );
}

/** A real QR code for `text`, drawn as one path on white. */
export function Qr({ text, label }: { text: string; label: string }) {
  const code = useMemo(() => encodeQr(text), [text]);
  if (!code) return null;
  const size = code.size + 8;
  return (
    <div className="qr">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} shapeRendering="crispEdges">
        <rect width={size} height={size} fill="#fff" /> {/* theme-ok: a QR code is dark on white for every camera, whatever the village's palette */}
        <path d={qrPath(code.modules)} fill="#111" /> {/* theme-ok: a QR code is dark on white for every camera, whatever the village's palette */}
      </svg>
    </div>
  );
}

/** The village's bottom bar, when it set one. */
export function BottomNav({ items, on }: { items: NavItem[]; on: string }) {
  if (!items.length) return null;
  return (
    <nav className="nav" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
      {items.map((it) => (
        <Link key={it.href} href={it.href} className={it.icon === on ? "on" : ""}>
          <Icon name={it.icon} />
          {it.label}
        </Link>
      ))}
    </nav>
  );
}

/** "just now", "3h", "2d": the pulse's own short clock. */
export function ago(iso: string, now = Date.now()): string {
  const ms = now - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 60_000) return "now";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
