/**
 * Where a member's pin goes on the Directory map: his state or province (US,
 * Canada, Australia) if we recognize it, else his country. Never his city.
 * Coordinates are approximate centers [latitude, longitude].
 */
type P = [name: string, lat: number, lon: number, aliases?: string[]];

const US: Record<string, P> = {
  AL: ["Alabama", 32.8, -86.8], AK: ["Alaska", 64.7, -152], AZ: ["Arizona", 34.3, -111.7], AR: ["Arkansas", 34.9, -92.4],
  CA: ["California", 37.2, -119.5, ["calif", "cali"]], CO: ["Colorado", 39, -105.5], CT: ["Connecticut", 41.6, -72.7],
  DE: ["Delaware", 39, -75.5], DC: ["Washington, DC", 38.9, -77, ["district of columbia", "washington dc"]], FL: ["Florida", 28.6, -82.4],
  GA: ["Georgia", 32.7, -83.4], HI: ["Hawaii", 20.8, -156.3], ID: ["Idaho", 44.4, -114.6], IL: ["Illinois", 40, -89.2],
  IN: ["Indiana", 39.9, -86.3], IA: ["Iowa", 42.1, -93.5], KS: ["Kansas", 38.5, -98.4], KY: ["Kentucky", 37.5, -85.3],
  LA: ["Louisiana", 31.1, -92], ME: ["Maine", 45.4, -69.2], MD: ["Maryland", 39, -76.8], MA: ["Massachusetts", 42.3, -71.8],
  MI: ["Michigan", 44.3, -85.4], MN: ["Minnesota", 46.3, -94.3], MS: ["Mississippi", 32.7, -89.7], MO: ["Missouri", 38.4, -92.5],
  MT: ["Montana", 47, -109.6], NE: ["Nebraska", 41.5, -99.8], NV: ["Nevada", 39.3, -116.6], NH: ["New Hampshire", 43.7, -71.6],
  NJ: ["New Jersey", 40.2, -74.7], NM: ["New Mexico", 34.4, -106.1], NY: ["New York", 42.9, -75.5], NC: ["North Carolina", 35.6, -79.4],
  ND: ["North Dakota", 47.5, -100.5], OH: ["Ohio", 40.3, -82.8], OK: ["Oklahoma", 35.6, -97.5], OR: ["Oregon", 43.9, -120.6],
  PA: ["Pennsylvania", 40.9, -77.8], RI: ["Rhode Island", 41.7, -71.5], SC: ["South Carolina", 33.9, -80.9], SD: ["South Dakota", 44.4, -100.2],
  TN: ["Tennessee", 35.9, -86.4], TX: ["Texas", 31.5, -99.3], UT: ["Utah", 39.3, -111.7], VT: ["Vermont", 44.1, -72.7],
  VA: ["Virginia", 37.5, -78.8], WA: ["Washington", 47.4, -120.5], WV: ["West Virginia", 38.6, -80.6], WI: ["Wisconsin", 44.6, -89.9],
  WY: ["Wyoming", 43, -107.6], PR: ["Puerto Rico", 18.2, -66.5],
};
const CA: Record<string, P> = {
  AB: ["Alberta", 55, -115], BC: ["British Columbia", 54, -125], MB: ["Manitoba", 55, -97.5], NB: ["New Brunswick", 46.5, -66.2],
  NL: ["Newfoundland and Labrador", 53, -60, ["newfoundland"]], NS: ["Nova Scotia", 45, -63], ON: ["Ontario", 50, -85],
  PE: ["Prince Edward Island", 46.3, -63.2, ["pei"]], QC: ["Quebec", 52, -72, ["québec"]], SK: ["Saskatchewan", 54, -106],
  YT: ["Yukon", 64, -135], NT: ["Northwest Territories", 64, -119], NU: ["Nunavut", 70, -90],
};
const AU: Record<string, P> = {
  NSW: ["New South Wales", -32, 147], VIC: ["Victoria", -37, 144.5], QLD: ["Queensland", -22, 144], WA: ["Western Australia", -25, 122],
  SA: ["South Australia", -30, 135], TAS: ["Tasmania", -42, 146.5], NT: ["Northern Territory", -19.5, 133.5], ACT: ["Australian Capital Territory", -35.5, 149],
};
const REGIONS: Record<string, Record<string, P>> = { us: US, ca: CA, au: AU };

const COUNTRIES: Record<string, P> = {
  us: ["USA", 39.8, -98.6, ["united states", "united states of america", "america", "u s", "u s a", "usa", "us"]],
  ca: ["Canada", 56, -106], mx: ["Mexico", 23.6, -102.5, ["méxico"]], gt: ["Guatemala", 15.7, -90.2], hn: ["Honduras", 15, -86.5],
  sv: ["El Salvador", 13.8, -88.9], ni: ["Nicaragua", 12.9, -85.2], cr: ["Costa Rica", 9.9, -84], pa: ["Panama", 8.5, -80],
  cu: ["Cuba", 21.5, -79.5], jm: ["Jamaica", 18.1, -77.3], do: ["Dominican Republic", 18.7, -70.2], ht: ["Haiti", 19, -72.3],
  pr: ["Puerto Rico", 18.2, -66.5], bs: ["Bahamas", 24.7, -77.8, ["the bahamas"]], tt: ["Trinidad and Tobago", 10.4, -61.3, ["trinidad"]],
  co: ["Colombia", 4.6, -74.1], ve: ["Venezuela", 7, -66], ec: ["Ecuador", -1.8, -78.2], pe: ["Peru", -9.2, -75], bo: ["Bolivia", -16.3, -63.6],
  br: ["Brazil", -14.2, -51.9, ["brasil"]], cl: ["Chile", -35.7, -71.5], ar: ["Argentina", -38.4, -63.6], uy: ["Uruguay", -32.5, -55.8], py: ["Paraguay", -23.4, -58.4],
  gb: ["United Kingdom", 54, -2.5, ["uk", "u k", "great britain", "britain"]], en: ["England", 52.4, -1.5], sc: ["Scotland", 56.5, -4.2],
  wl: ["Wales", 52.1, -3.8], nir: ["Northern Ireland", 54.6, -6.7], ie: ["Ireland", 53.4, -8.2, ["republic of ireland"]],
  fr: ["France", 46.6, 2.2], de: ["Germany", 51.2, 10.4, ["deutschland"]], nl: ["Netherlands", 52.1, 5.3, ["holland", "the netherlands"]],
  be: ["Belgium", 50.5, 4.5], ch: ["Switzerland", 46.8, 8.2], at: ["Austria", 47.5, 14.6], it: ["Italy", 42.8, 12.6], es: ["Spain", 40.4, -3.7],
  pt: ["Portugal", 39.4, -8.2], dk: ["Denmark", 56.3, 9.5], no: ["Norway", 61, 8.5], se: ["Sweden", 62, 15], fi: ["Finland", 64, 26],
  is: ["Iceland", 64.9, -19], pl: ["Poland", 52, 19.1], cz: ["Czechia", 49.8, 15.5, ["czech republic"]], hu: ["Hungary", 47.2, 19.5],
  ro: ["Romania", 45.9, 24.9], gr: ["Greece", 39.1, 21.8], ua: ["Ukraine", 48.4, 31.2], ru: ["Russia", 61.5, 105], tr: ["Turkey", 39, 35.2, ["türkiye"]],
  il: ["Israel", 31.4, 35], lb: ["Lebanon", 33.9, 35.9], jo: ["Jordan", 31, 36], sa: ["Saudi Arabia", 23.9, 45.1], ae: ["United Arab Emirates", 24, 54, ["uae", "u a e"]],
  eg: ["Egypt", 26.8, 30.8], ng: ["Nigeria", 9.1, 8.7], gh: ["Ghana", 7.9, -1], ke: ["Kenya", 0, 37.9], ug: ["Uganda", 1.4, 32.3],
  tz: ["Tanzania", -6.4, 34.9], et: ["Ethiopia", 9.1, 40.5], za: ["South Africa", -30.6, 22.9], zw: ["Zimbabwe", -19, 29.2], zm: ["Zambia", -13.1, 27.8],
  in: ["India", 21, 78.9], pk: ["Pakistan", 30.4, 69.3], cn: ["China", 35.9, 104.2], hk: ["Hong Kong", 22.3, 114.2], tw: ["Taiwan", 23.7, 121],
  jp: ["Japan", 36.2, 138.3], kr: ["South Korea", 36.5, 127.9, ["korea"]], ph: ["Philippines", 12.9, 121.8, ["the philippines"]],
  vn: ["Vietnam", 14.1, 108.3], th: ["Thailand", 15.9, 101], my: ["Malaysia", 4.2, 102], sg: ["Singapore", 1.35, 103.8],
  id: ["Indonesia", -2.5, 118], au: ["Australia", -25.3, 133.8], nz: ["New Zealand", -41, 174.9],
};

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
const names = (code: string, p: P) => [code.toLowerCase(), norm(p[0]), ...(p[3] ?? []).map(norm)];

function findCountry(text: string): string | null {
  const t = norm(text);
  if (!t) return null;
  for (const [code, p] of Object.entries(COUNTRIES)) if (names(code, p).slice(1).includes(t) || (t.length > 2 && code === t)) return code;
  return null;
}
function findRegion(text: string, prefer: string[]): { country: string; code: string } | null {
  const t = norm(text);
  if (!t) return null;
  for (const country of prefer) {
    for (const [code, p] of Object.entries(REGIONS[country])) if (names(code, p).includes(t)) return { country, code };
  }
  return null;
}

export type Place = { key: string; label: string; lat: number; lon: number };

/** His map spot from what he typed for country and state, or null if we don't recognize either. */
export function placeFor(country: string | null | undefined, state: string | null | undefined): Place | null {
  const c = findCountry(country ?? "");
  // A state we recognize: within his country if it has states here, or (no country given) US first.
  const prefer = c ? (REGIONS[c] ? [c] : []) : ["us", "ca", "au"];
  const r = findRegion(state ?? "", prefer);
  if (r) {
    const p = REGIONS[r.country][r.code];
    return { key: `${r.country}-${r.code.toLowerCase()}`, label: `${p[0]}, ${COUNTRIES[r.country][0]}`, lat: p[1], lon: p[2] };
  }
  // UK nations typed in the state box ("England", "Scotland")
  const uk = c === "gb" || !c ? findCountry(state ?? "") : null;
  if (uk && ["en", "sc", "wl", "nir"].includes(uk)) { const p = COUNTRIES[uk]; return { key: uk, label: `${p[0]}, UK`, lat: p[1], lon: p[2] }; }
  if (c) { const p = COUNTRIES[c]; return { key: c, label: p[0], lat: p[1], lon: p[2] }; }
  return null;
}
