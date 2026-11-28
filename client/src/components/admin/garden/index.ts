/**
 * THE ADMIN GARDEN'S LOOK, as importable pieces (the frame, slice 6; Rye's
 * rulings of 27 Nov 2026: night first, painted buildings, lanterns and the
 * existing glyphs, two lenses with a toggle, the place names stand and each
 * person may rename them).
 *
 * Every piece draws inside one <Garden>, which carries the night-first tokens
 * (garden.css). Every piece takes its words and its facts as props and fetches
 * nothing.
 *
 * Keep it out of the first page: import it from admin code only, which is a
 * lazy route already. Its stylesheet, and the nature kit's, travel with the
 * chunk that imports it.
 */
export { default as Garden, GARDEN, useGardenSettings } from "./Garden";
export type { GardenProps, GardenSettings } from "./Garden";
export { GardenFrame, useGardenDock, defaultGardenDock, dockDrawnAfter, GARDEN_DOCK_KEY, GARDEN_FRAME_TWO_COLUMNS_REM } from "./frame";
export type { GardenDock, GardenDockState, GardenFrameProps } from "./frame";
export { default as StatusBand } from "./StatusBand";
export type { StatusBandAction, StatusBandProps } from "./StatusBand";
export { default as Place, Lantern } from "./Place";
export type { LanternProps, PlaceProps } from "./Place";
export { default as SteppingStones } from "./SteppingStones";
export type { SteppingStonesProps, Stone, StoneState } from "./SteppingStones";
export { default as Circle } from "./Circle";
export type { CirclePerson, CircleProps } from "./Circle";
export { default as SeedOfLife, SEED_CIRCLES_MAX } from "./SeedOfLife";
export type { SeedOfLifeProps } from "./SeedOfLife";
export { default as Fireflies } from "./Fireflies";
export type { FirefliesProps } from "./Fireflies";
export { Desk, Grounds } from "./Grounds";
export type { DeskProps, GardenPlaceState, GroundsProps } from "./Grounds";
export { useGuideSpeaking, useGardenWords, useNumberWord, dayPartOf, readGuideSpeaking, GARDEN_SPEAKING_KEY, GUIDE_SPEAKING, DEFAULT_GUIDE_SPEAKING } from "./speaking";
export type { DayPart, GardenWords, GuideSpeaking, GuideSpeakingState } from "./speaking";
export { ViewSwitch } from "./view";
export type { ViewSwitchProps } from "./view";
export { LensToggle, useGardenLens, GARDEN_LENS_KEY } from "./lens";
export type { GardenLens, GardenLensState, LensToggleProps } from "./lens";
export { GroundPicker, useGardenGround, GARDEN_GROUND_PICK_KEY } from "./groundPick";
export type { GardenGroundState, GroundPickerProps } from "./groundPick";
export { RenamePlace, usePlaceNames, GARDEN_NAMES_KEY } from "./placeNames";
export type { PlaceNames, RenamePlaceProps } from "./placeNames";
export { GARDEN_PLACES, GARDEN_PLACE_KEYS, PLACE_NAME_MAX } from "./places";
export type { GardenPlace, GardenPlaceKey } from "./places";
export { GARDEN_GUIDE_URL, gardenSpriteUrl, GARDEN_GROUND_KEYS, DEFAULT_GARDEN_GROUND, gardenGroundUrl } from "@shared/gardenArt";
export type { GardenGroundKey } from "@shared/gardenArt";
