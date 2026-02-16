declare module 'ngeohash' {
  export function encode(lat: number, lon: number, precision?: number): string;
  export function decode(geohash: string): { latitude: number; longitude: number; latitudeError: number; longitudeError: number };
  export function neighbours(geohash: string): { [dir: string]: string };
  const _default: {
    encode: typeof encode;
    decode: typeof decode;
    neighbours: typeof neighbours;
  };
  export default _default;
}
