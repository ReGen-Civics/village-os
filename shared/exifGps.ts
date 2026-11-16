/**
 * Read the GPS position a phone wrote into a JPEG, and nothing else.
 *
 * The hidden map fills a pin's location from the photo, then throws the
 * photo's metadata away before anything leaves the device. This reads the
 * position from the ORIGINAL bytes, in the browser, before the re-encode.
 *
 * A JPEG keeps its EXIF in an APP1 segment ("Exif\0\0"), which holds a TIFF
 * structure: a byte-order mark, IFD0, and a pointer (tag 0x8825) to the GPS
 * IFD. The GPS IFD carries latitude and longitude as three rationals each
 * (degrees, minutes, seconds) with an N/S and E/W reference.
 *
 * About a hundred lines and no dependency. Anything it does not understand is
 * an answer of null: a malformed file never throws, and never produces a
 * place it did not read.
 */

export interface GpsReading {
  lat: number;
  lng: number;
}

/** The GPS position in a JPEG, or null when there is none or it cannot be read. */
export function readJpegGps(input: ArrayBuffer | Uint8Array): GpsReading | null {
  try {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;
    let at = 2;
    while (at + 4 <= view.byteLength) {
      if (view.getUint8(at) !== 0xff) return null;
      const marker = view.getUint8(at + 1);
      // Start of scan or end of image: no EXIF came before the picture.
      if (marker === 0xda || marker === 0xd9) return null;
      const len = view.getUint16(at + 2);
      if (len < 2) return null;
      if (marker === 0xe1 && at + 10 <= view.byteLength && ascii(view, at + 4, 4) === "Exif") {
        return readTiff(view, at + 10, Math.min(view.byteLength, at + 2 + len));
      }
      at += 2 + len;
    }
    return null;
  } catch {
    return null;
  }
}

function ascii(view: DataView, at: number, n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += String.fromCharCode(view.getUint8(at + i));
  return s;
}

function readTiff(view: DataView, base: number, end: number): GpsReading | null {
  const order = ascii(view, base, 2);
  const le = order === "II";
  if (!le && order !== "MM") return null;
  const u16 = (o: number) => view.getUint16(base + o, le);
  const u32 = (o: number) => view.getUint32(base + o, le);
  const inRange = (o: number, n: number) => base + o >= base && base + o + n <= end;
  if (!inRange(0, 8) || u16(2) !== 42) return null;

  const entries = (ifd: number): Array<{ tag: number; type: number; count: number; value: number }> => {
    if (!inRange(ifd, 2)) return [];
    const n = u16(ifd);
    const out: Array<{ tag: number; type: number; count: number; value: number }> = [];
    for (let i = 0; i < n && i < 512; i++) {
      const e = ifd + 2 + i * 12;
      if (!inRange(e, 12)) break;
      out.push({ tag: u16(e), type: u16(e + 2), count: u32(e + 4), value: e + 8 });
    }
    return out;
  };

  const gpsPtr = entries(u32(4)).find((e) => e.tag === 0x8825);
  if (!gpsPtr) return null;
  const gps = entries(u32(gpsPtr.value - 0));

  const ref = (tag: number): string | null => {
    const e = gps.find((x) => x.tag === tag);
    if (!e || e.type !== 2) return null;
    return String.fromCharCode(view.getUint8(base + e.value)).toUpperCase();
  };
  const dms = (tag: number): number | null => {
    const e = gps.find((x) => x.tag === tag);
    // Three RATIONALs (type 5), 24 bytes, always stored at an offset.
    if (!e || e.type !== 5 || e.count !== 3) return null;
    const off = u32(e.value);
    if (!inRange(off, 24)) return null;
    const part = (i: number) => {
      const d = u32(off + i * 8 + 4);
      return d === 0 ? NaN : u32(off + i * 8) / d;
    };
    const v = part(0) + part(1) / 60 + part(2) / 3600;
    return Number.isFinite(v) ? v : null;
  };

  const latRef = ref(0x0001);
  const lngRef = ref(0x0003);
  const lat = dms(0x0002);
  const lng = dms(0x0004);
  if (lat === null || lng === null || !latRef || !lngRef) return null;
  const signedLat = latRef === "S" ? -lat : lat;
  const signedLng = lngRef === "W" ? -lng : lng;
  if (Math.abs(signedLat) > 90 || Math.abs(signedLng) > 180) return null;
  // A phone with no fix writes zeros. Null Island is nobody's garden.
  if (signedLat === 0 && signedLng === 0) return null;
  return { lat: Math.round(signedLat * 1e6) / 1e6, lng: Math.round(signedLng * 1e6) / 1e6 };
}
