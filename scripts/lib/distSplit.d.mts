/**
 * Types for the part of distSplit.mjs a TypeScript test imports
 * (client/src/lib/routePreloadReader.test.ts holds the size gate's reader of
 * the route-preload table to the table's writer). The rule itself and the rest
 * of the module are plain JavaScript, used by scripts/check-dist-budget.mjs.
 */
export interface AppRoute {
  /** The route's path as App.tsx writes it, or the tag's own text when it could not be read. */
  path: string;
  component: string | null;
  kind: "lazy" | "eager" | "redirect" | "unread";
  /** The lazily imported page behind the component, as "client/src/pages/Name", or null. */
  page: string | null;
}
export interface RoutePreloadRows {
  files: string[];
  /** [the route's pattern, indexes into `files`], in route order. */
  rows: Array<[string, number[]]>;
}
export const ROAD_TO_LAUNCH_PATHS: string[];
/** Who opens each address under /admin, with the file and the line of code that proves it. */
export const ADMIN_PATH_RULINGS: Array<{ path: string; opens: "admins" | "members"; file: string; proof: string }>;
export const MEMBER_OPENED_ADMIN_PATHS: string[];
export function isUnderAdmin(routePath: string): boolean;
export function isAdminPath(routePath: string, roadPaths?: string[], memberOpened?: string[]): boolean;
export function routesFromApp(appSource: string): AppRoute[];
export function unreadRoutes(routes: AppRoute[]): string[];
export function routePatternOf(routePath: string): string;
export function readRoutePreloadTable(text: string): RoutePreloadRows | null;
export function preloadFilesForMembers(table: RoutePreloadRows, routes: AppRoute[], roadPaths?: string[]): string[];
