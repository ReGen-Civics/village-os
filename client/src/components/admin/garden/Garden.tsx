/**
 * THE GARDEN'S SCOPE: the one element that carries the night-first tokens
 * (garden.css, `.garden`), and what the pieces inside need to know about the
 * person looking.
 *
 * Every garden piece draws inside one of these. Put it on an element of its
 * own inside the admin root; it needs nothing from the page around it.
 */
import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { GardenPlaceKey } from "./places";
import "./garden.css";

/** The scope as a class string, for a caller that owns its own root element. */
export const GARDEN = "garden";

export interface GardenSettings {
  /** Something that tells one person from another in a shared browser (an id, never a name). Their lens and place names are kept under it. */
  personKey?: string;
  /** The village's own names for the places, where it has set any. A person's own name still comes first. */
  villageNames?: Partial<Record<GardenPlaceKey, string>>;
}

const GardenContext = createContext<GardenSettings>({});

/** What the nearest <Garden> was told; empty outside one. */
export function useGardenSettings(): GardenSettings {
  return useContext(GardenContext);
}

export interface GardenProps extends GardenSettings {
  className?: string;
  children: ReactNode;
}

export default function Garden({ personKey, villageNames, className = "", children }: GardenProps) {
  const settings = useMemo(() => ({ personKey, villageNames }), [personKey, villageNames]);
  return (
    <GardenContext.Provider value={settings}>
      <div className={`${GARDEN} ${className}`.trim()}>{children}</div>
    </GardenContext.Provider>
  );
}
