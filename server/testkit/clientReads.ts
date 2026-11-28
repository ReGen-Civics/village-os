/**
 * WHICH SERVER ROUTES A PAGE'S OWN CODE CALLS, READ FROM THE CLIENT'S SOURCE, for the registry's `reads` and its test.
 *
 * An act may name the GET routes its page reads (`reads`, shared/adminActs/types.ts). That is a claim about the
 * client, and a claim nobody checks goes stale. This reads the client the way a person would: start at the page's
 * component and follow what it draws and calls, name by name, into the files those names come from.
 *
 *   a tab's code    client/src/pages/Admin.tsx draws a tab with `activeTab === "<key>" && <Component ...>`. The
 *                   component's own text is read, then every component it draws and every function it calls,
 *                   whether declared beside it or imported from another file under client/src.
 *   a page's code   client/src/App.tsx routes a path to a component. The same walk starts there.
 *
 * It follows NAMES, never whole files: importing one hook from a file of twenty reads that one hook. A walk by
 * whole files credited one tab with every call in every helper file it touched.
 *
 * WHAT IT CANNOT SEE. A path built from pieces at run time (a base in one constant and a tail in another), a call
 * made by something handed in as a prop from outside the page, and a name used only as a value and never drawn or
 * called. A route it misses is simply not found, so it is never claimed: the reader errs toward leaving a route
 * open. It also cannot tell a GET from a write to the same path, so a page that only writes a path reads as
 * calling it.
 *
 * A path matches where the source holds it as a string or a template: `/api/admin/players/:id/notes` matches
 * "/api/admin/players/${id}/notes". Each `:name` part must be a `${...}`.
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

/** How many names away from the page's component the walk goes. */
const HOPS = 12;

interface Imported {
  file: string;
  /** The name it has in that file, or "default". */
  exported: string;
}

interface Parsed {
  /** Local name -> where it comes from, for imports that resolve inside client/src. */
  imports: Map<string, Imported>;
  /** Top-level functions, constants and classes, by name, with their own text. */
  declared: Map<string, string>;
  /** The local name of the default export, when it has one. */
  defaultName: string | null;
  /** `export { A as B } from "./x"` and `export * from "./x"`, so a name re-exported here is followed. */
  reexports: Array<{ file: string; names: Map<string, string> | null }>;
}

export class ClientReader {
  private readonly parsed = new Map<string, Parsed | null>();
  private readonly memo = new Map<string, string>();
  private tabs: Map<string, string> | null = null;
  private pages: Map<string, string> | null = null;

  constructor(private readonly root: string) {}

  private get src(): string {
    return path.join(this.root, "client", "src");
  }

  private resolve(from: string, spec: string): string | null {
    let base: string;
    if (spec.startsWith("@/")) base = path.join(this.src, spec.slice(2));
    else if (spec.startsWith("@shared/")) base = path.join(this.root, "shared", spec.slice("@shared/".length));
    else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
    else return null;
    for (const p of [base, `${base}.tsx`, `${base}.ts`, path.join(base, "index.tsx"), path.join(base, "index.ts")]) {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
    }
    return null;
  }

  private parse(file: string): Parsed | null {
    if (this.parsed.has(file)) return this.parsed.get(file) ?? null;
    if (!fs.existsSync(file) || /\.test\.tsx?$/.test(file)) {
      this.parsed.set(file, null);
      return null;
    }
    const text = fs.readFileSync(file, "utf8");
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const made: Parsed = { imports: new Map(), declared: new Map(), defaultName: null, reexports: [] };
    const isDefault = (n: ts.Node) => !!(ts.canHaveModifiers(n) && ts.getModifiers(n)?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword));
    for (const stmt of sf.statements) {
      if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier) && !stmt.importClause?.isTypeOnly) {
        const target = this.resolve(file, stmt.moduleSpecifier.text);
        const clause = stmt.importClause;
        if (!target || !clause) continue;
        if (clause.name) made.imports.set(clause.name.text, { file: target, exported: "default" });
        if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
          for (const el of clause.namedBindings.elements) if (!el.isTypeOnly) made.imports.set(el.name.text, { file: target, exported: el.propertyName?.text ?? el.name.text });
        }
      } else if (ts.isExportDeclaration(stmt) && stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier)) {
        const target = this.resolve(file, stmt.moduleSpecifier.text);
        if (!target) continue;
        const names = stmt.exportClause && ts.isNamedExports(stmt.exportClause) ? new Map(stmt.exportClause.elements.map((el) => [el.name.text, el.propertyName?.text ?? el.name.text])) : null;
        made.reexports.push({ file: target, names });
      } else if (ts.isFunctionDeclaration(stmt) || ts.isClassDeclaration(stmt)) {
        const name = stmt.name?.text ?? (isDefault(stmt) ? "default" : null);
        if (name) made.declared.set(name, stmt.getText(sf));
        if (isDefault(stmt)) made.defaultName = name;
      } else if (ts.isVariableStatement(stmt)) {
        for (const d of stmt.declarationList.declarations) {
          if (!ts.isIdentifier(d.name)) continue;
          made.declared.set(d.name.text, d.getText(sf));
          // `const X = lazy(() => import("./Y"))`, with or without `.then((m) => ({ default: m.Named }))`.
          const init = d.initializer?.getText(sf) ?? "";
          const dynamic = /import\(\s*["']([^"']+)["']\s*\)/.exec(init);
          const target = dynamic ? this.resolve(file, dynamic[1]) : null;
          if (target) made.imports.set(d.name.text, { file: target, exported: /default:\s*\w+\.(\w+)/.exec(init)?.[1] ?? "default" });
        }
      } else if (ts.isExportAssignment(stmt) && ts.isIdentifier(stmt.expression)) {
        made.defaultName = stmt.expression.text;
      }
    }
    this.parsed.set(file, made);
    return made;
  }

  /**
   * What one name declared in, or exported from, a file says: its own text, and the text of everything it draws or
   * calls, however many names away. Each name is visited once.
   */
  private says(file: string, name: string): string {
    const startKey = `${file}::${name}`;
    const done = this.memo.get(startKey);
    if (done !== undefined) return done;
    const seen = new Set<string>([startKey]);
    let frontier: Array<{ file: string; name: string }> = [{ file, name }];
    let text = "";
    const visit = (next: Array<{ file: string; name: string }>, at: { file: string; name: string }) => {
      const key = `${at.file}::${at.name}`;
      if (seen.has(key)) return;
      seen.add(key);
      next.push(at);
    };
    for (let hop = 0; hop <= HOPS && frontier.length; hop++) {
      const next: Array<{ file: string; name: string }> = [];
      for (const at of frontier) {
        const p = this.parse(at.file);
        if (!p) continue;
        const local = at.name === "default" ? p.defaultName ?? "default" : at.name;
        const body = p.declared.get(local);
        const imported = p.imports.get(local);
        // A lazy import is both a constant and an import. What it draws is the file it loads.
        if (imported) {
          visit(next, { file: imported.file, name: imported.exported });
        } else if (body) {
          text += `\n${body}`;
          // The names it draws (`<Name`), calls (`name(`) or hands on as a value (`={Name}`, `(Name)`, `, Name`).
          for (const m of Array.from(body.matchAll(/<([A-Z][\w$]*)|\b([A-Za-z_$][\w$]*)\s*\(|[={(,]\s*([A-Z][\w$]*)\s*[})\],]/g))) {
            const id = m[1] ?? m[2] ?? m[3];
            if (id !== local && (p.declared.has(id) || p.imports.has(id))) visit(next, { file: at.file, name: id });
          }
        } else {
          for (const re of p.reexports) {
            const inner = re.names ? re.names.get(at.name) : at.name;
            if (inner) visit(next, { file: re.file, name: inner });
          }
        }
      }
      frontier = next;
    }
    this.memo.set(startKey, text);
    return text;
  }

  /**
   * Tab key -> the component Admin.tsx draws for it. Admin.tsx draws a tab in three shapes, and each is read:
   *
   *   `activeTab === "k" && <Comp`                       with or without a `<Suspense>` around the component
   *   `(activeTab === "a" || activeTab === "b") && ... activeTab === "a" ? <A /> : <B />`
   *   `CONTENT_SECTIONS.map(...)`                        one editor for every key of that table
   *
   * A tab drawn some other way has no component here, and nothing is claimed for it.
   */
  tabComponents(): Map<string, string> {
    if (this.tabs) return this.tabs;
    const text = fs.readFileSync(path.join(this.src, "pages", "Admin.tsx"), "utf8");
    const tabs = new Map<string, string>();
    const set = (key: string, component: string) => {
      if (component !== "Suspense" && !tabs.has(key)) tabs.set(key, component);
    };
    for (const m of Array.from(text.matchAll(/activeTab === "([a-z0-9-]+)"\s*&&\s*\(?\s*(?:<Suspense[^>]*>\s*)?<([A-Z][\w]*)/g))) set(m[1], m[2]);
    for (const m of Array.from(text.matchAll(/\(activeTab === "([a-z0-9-]+)" \|\| activeTab === "([a-z0-9-]+)"\)\s*&&\s*(?:<Suspense[^>]*>\s*)?\{activeTab === "([a-z0-9-]+)" \? <([A-Z][\w]*)[^:]*?: <([A-Z][\w]*)/g))) {
      const other = m[3] === m[1] ? m[2] : m[1];
      set(m[3], m[4]);
      set(other, m[5]);
    }
    const editor = /CONTENT_SECTIONS\.map\([^<]*<([A-Z][\w]*)/.exec(text)?.[1];
    if (editor) for (const key of this.contentSectionKeys()) set(key, editor);
    this.tabs = tabs;
    return tabs;
  }

  /** The keys of CONTENT_SECTIONS (client/src/components/admin/contentSections), a literal or a constant each. */
  private contentSectionKeys(): string[] {
    const dir = path.join(this.src, "components", "admin");
    const file = [path.join(dir, "contentSections.ts"), path.join(dir, "contentSections.tsx")].find((p) => fs.existsSync(p));
    if (!file) return [];
    const text = fs.readFileSync(file, "utf8");
    const constant = (name: string): string | null => {
      const here = new RegExp(`const ${name}\\s*=\\s*"([^"]+)"`).exec(text)?.[1];
      if (here) return here;
      for (const m of Array.from(text.matchAll(/import\s*\{[^}]*\}\s*from\s*"([^"]+)"/g))) {
        if (!new RegExp(`\\b${name}\\b`).test(m[0])) continue;
        const target = this.resolve(file, m[1]);
        const found = target ? new RegExp(`const ${name}\\s*=\\s*"([^"]+)"`).exec(fs.readFileSync(target, "utf8"))?.[1] : null;
        if (found) return found;
      }
      return null;
    };
    const keys: string[] = [];
    for (const m of Array.from(text.matchAll(/\{\s*key:\s*(?:"([^"]+)"|([A-Z_][A-Z0-9_]*))\s*,\s*label:/g))) {
      const key = m[1] ?? constant(m[2]);
      if (key) keys.push(key);
    }
    return keys;
  }

  /** Router path -> the component App.tsx draws for it. */
  pageComponents(): Map<string, string> {
    if (this.pages) return this.pages;
    const text = fs.readFileSync(path.join(this.src, "App.tsx"), "utf8");
    this.pages = new Map();
    for (const m of Array.from(text.matchAll(/<Route\s+path="([^"]+)"[^>]*?component=\{([A-Z][\w]*)\}/g))) if (!this.pages.has(m[1])) this.pages.set(m[1], m[2]);
    for (const m of Array.from(text.matchAll(/<Route\s+path="([^"]+)"\s*>\s*(?:\{[^<]*)?<([A-Z][\w]*)/g))) if (!this.pages.has(m[1])) this.pages.set(m[1], m[2]);
    return this.pages;
  }

  /** Everything the code behind an Admin tab says, or "" when Admin.tsx draws no one component for that key. */
  tabCode(tab: string): string {
    const component = this.tabComponents().get(tab);
    return component ? this.says(path.join(this.src, "pages", "Admin.tsx"), component) : "";
  }

  /** Everything the code behind a routed page says, or "" when the router has no such path. */
  pageCode(routePath: string): string {
    const component = this.pageComponents().get(routePath.replace(/[?#].*$/, ""));
    return component ? this.says(path.join(this.src, "App.tsx"), component) : "";
  }
}

/** The three ways the client spells the base of an API path: "/api", `${API_BASE}` (which is "/api"), and `${API_BASE}/api` in the one file whose base is empty. */
const API_HEAD = "(?:/api|\\$\\{API_BASE\\}(?:/api)?)";

/**
 * A route's path as a pattern over source text. Each `:name` part must be a `${...}` in a template: a plain word in
 * that place is another route (`/players/detail` is never `/players/:id`).
 */
export function pathPattern(routePath: string): RegExp {
  const one = (part: string) => (part.startsWith(":") ? "\\$\\{[^}]*\\}" : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = routePath.split("/").filter(Boolean);
  const head = parts[0] === "api" ? API_HEAD : `/${one(parts[0] ?? "")}`;
  const tail = parts
    .slice(1)
    .map((part) => `/${one(part)}`)
    .join("");
  // The path ends where the string does, or where a query begins.
  return new RegExp(`["'\`]${head}${tail}(?:["'\`?]|\\$\\{)`);
}

/** Whether source text calls a route's path. */
export function codeCalls(code: string, routePath: string): boolean {
  return pathPattern(routePath).test(code);
}
