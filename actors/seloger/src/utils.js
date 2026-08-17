/** Small parsing helpers. SeLoger formats everything for French humans, not machines. */

/** Normal, narrow and non-breaking spaces all show up in SeLoger strings. */
const SPACES = /[\s   ]/g;

/**
 * "4 052,63 €/m²" -> 4052.63 ; "228 kWh/m².an" -> 228 ; "" -> null
 * Deliberately takes the FIRST number in the string.
 */
export function toNumber(input) {
    if (input === null || input === undefined) return null;
    if (typeof input === 'number') return Number.isFinite(input) ? input : null;

    const cleaned = String(input).replace(SPACES, '');
    // French decimals use a comma; thousands separators were spaces (now stripped).
    const match = cleaned.match(/-?\d+(?:[.,]\d+)?/);
    if (!match) return null;

    const value = Number.parseFloat(match[0].replace(',', '.'));
    return Number.isFinite(value) ? value : null;
}

/** Same as toNumber but rounds to an integer, for prices / areas / counts. */
export function toInt(input) {
    const value = toNumber(input);
    return value === null ? null : Math.round(value);
}

/** Strips the <b> tags SeLoger sprinkles through agency legal notices. */
export function stripTags(input) {
    if (!input) return '';
    return String(input)
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Safe deep get: pick(obj, ['a', 'b', 0, 'c']) */
export function pick(obj, path, fallback = null) {
    let cursor = obj;
    for (const key of path) {
        if (cursor === null || cursor === undefined) return fallback;
        cursor = cursor[key];
    }
    return cursor === undefined ? fallback : cursor;
}

/** Always hand back an array, whatever we were given. */
export function asArray(value) {
    if (Array.isArray(value)) return value;
    if (value === null || value === undefined) return [];
    return [value];
}

/**
 * Area-weighted centroid of a GeoJSON Polygon / MultiPolygon.
 *
 * SeLoger never publishes the exact address of a listing — it publishes the
 * *district* polygon instead. We return its centroid so downstream consumers
 * still get a usable lat/lng, but callers must treat it as approximate:
 * it is the middle of a neighbourhood, not the front door.
 */
export function polygonCentroid(geometry) {
    if (!geometry || !geometry.coordinates) return null;

    const rings =
        geometry.type === 'MultiPolygon'
            ? geometry.coordinates.map((polygon) => polygon[0])
            : geometry.type === 'Polygon'
                ? [geometry.coordinates[0]]
                : [];

    let totalArea = 0;
    let cx = 0;
    let cy = 0;

    for (const ring of rings) {
        if (!Array.isArray(ring) || ring.length < 3) continue;

        let area = 0;
        let x = 0;
        let y = 0;

        for (let i = 0; i < ring.length; i++) {
            const [x1, y1] = ring[i];
            const [x2, y2] = ring[(i + 1) % ring.length];
            const cross = x1 * y2 - x2 * y1;
            area += cross;
            x += (x1 + x2) * cross;
            y += (y1 + y2) * cross;
        }

        area /= 2;
        if (area === 0) continue;

        cx += x / (6 * area) * Math.abs(area);
        cy += y / (6 * area) * Math.abs(area);
        totalArea += Math.abs(area);
    }

    if (!totalArea) return null;

    return {
        longitude: Number((cx / totalArea).toFixed(5)),
        latitude: Number((cy / totalArea).toFixed(5)),
    };
}
