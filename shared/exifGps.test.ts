/**
 * Reading a photo's GPS position: little-endian (the shared fixture, which is
 * what most phones write), big-endian (built here), none, and broken.
 */
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { buildGeotaggedJpeg, FIXTURE_LAT, FIXTURE_LON } from "../server/lib/exifFixture";
import { readJpegGps } from "./exifGps";

const plain = () => sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 10, g: 80, b: 40 } } }).jpeg().toBuffer();

/** A big-endian APP1 with one GPS IFD, spliced in after SOI. */
function bigEndianGps(jpeg: Buffer, lat: number, lng: number): Buffer {
  const t = Buffer.alloc(8 + 2 + 12 + 4 + 2 + 4 * 12 + 4 + 48);
  t.write("MM", 0, "ascii");
  t.writeUInt16BE(42, 2);
  t.writeUInt32BE(8, 4);
  // IFD0: one entry, the GPS pointer.
  t.writeUInt16BE(1, 8);
  t.writeUInt16BE(0x8825, 10);
  t.writeUInt16BE(4, 12);
  t.writeUInt32BE(1, 14);
  const gpsAt = 8 + 2 + 12 + 4;
  t.writeUInt32BE(gpsAt, 18);
  t.writeUInt32BE(0, 22);
  t.writeUInt16BE(4, gpsAt);
  const dataAt = gpsAt + 2 + 4 * 12 + 4;
  const entry = (i: number, tag: number, type: number, count: number, write: (o: number) => void) => {
    const e = gpsAt + 2 + i * 12;
    t.writeUInt16BE(tag, e);
    t.writeUInt16BE(type, e + 2);
    t.writeUInt32BE(count, e + 4);
    write(e + 8);
  };
  const rats = (v: number, at: number) => {
    const a = Math.abs(v);
    const d = Math.floor(a);
    const m = Math.floor((a - d) * 60);
    const s = Math.round(((a - d) * 60 - m) * 60 * 1000);
    [[d, 1], [m, 1], [s, 1000]].forEach(([n, den], i) => {
      t.writeUInt32BE(n, at + i * 8);
      t.writeUInt32BE(den, at + i * 8 + 4);
    });
  };
  entry(0, 0x0001, 2, 2, (o) => t.write(lat >= 0 ? "N\0" : "S\0", o, "ascii"));
  entry(1, 0x0002, 5, 3, (o) => t.writeUInt32BE(dataAt, o));
  entry(2, 0x0003, 2, 2, (o) => t.write(lng >= 0 ? "E\0" : "W\0", o, "ascii"));
  entry(3, 0x0004, 5, 3, (o) => t.writeUInt32BE(dataAt + 24, o));
  rats(lat, dataAt);
  rats(lng, dataAt + 24);
  const head = Buffer.from("Exif\0\0", "binary");
  const seg = Buffer.alloc(4);
  seg.writeUInt16BE(0xffe1, 0);
  seg.writeUInt16BE(2 + head.length + t.length, 2);
  return Buffer.concat([jpeg.subarray(0, 2), seg, head, t, jpeg.subarray(2)]);
}

describe("readJpegGps", () => {
  it("reads the little-endian fixture a phone would write", async () => {
    const got = readJpegGps(buildGeotaggedJpeg(await plain()));
    expect(got).not.toBeNull();
    expect(got!.lat).toBeCloseTo(FIXTURE_LAT, 3);
    expect(got!.lng).toBeCloseTo(FIXTURE_LON, 3);
  });

  it("reads big-endian, south and east", async () => {
    const got = readJpegGps(bigEndianGps(await plain(), -33.8688, 151.2093));
    expect(got!.lat).toBeCloseTo(-33.8688, 3);
    expect(got!.lng).toBeCloseTo(151.2093, 3);
  });

  it("answers null for a photo with no GPS, a PNG, empty bytes and a truncated file", async () => {
    const jpeg = await plain();
    expect(readJpegGps(jpeg)).toBeNull();
    expect(readJpegGps(await sharp(jpeg).png().toBuffer())).toBeNull();
    expect(readJpegGps(new Uint8Array(0))).toBeNull();
    const geo = buildGeotaggedJpeg(jpeg);
    expect(readJpegGps(geo.subarray(0, 40))).toBeNull();
  });

  it("answers null for a 0,0 fix, which is a phone that had none", async () => {
    expect(readJpegGps(bigEndianGps(await plain(), 0, 0))).toBeNull();
  });

  it("finds nothing once the photo has been re-encoded", async () => {
    const geo = buildGeotaggedJpeg(await plain());
    expect(readJpegGps(await sharp(geo).webp().toBuffer())).toBeNull();
    expect(readJpegGps(await sharp(geo).jpeg().toBuffer())).toBeNull();
  });
});
