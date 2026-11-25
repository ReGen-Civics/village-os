/**
 * The LivingMap page behind the members-only door (components/map/MapMembersDoor.tsx): a reader the map
 * refuses (the map module at Members, and a visitor who is not signed in) meets a page that points
 * to the circles, never an empty map. A file of its own so App.tsx keeps one lazy page per route,
 * and it draws the page frame (Layout, with its language selector) around the members' panel.
 */
import Layout from "@/components/Layout";
import { MapForMembers, useMapVerdict } from "@/components/map/MapMembersDoor";
import LivingMap from "./LivingMap";

export default function LivingMapForMembers() {
  const { verdict, signedIn } = useMapVerdict();
  if (verdict === "asking") return null;
  if (verdict === "open") return <LivingMap />;
  return (
    <Layout>
      <MapForMembers signedIn={signedIn} />
    </Layout>
  );
}
