/**
 * Coordinates for Bangladeshi places, and the distance maths that uses them.
 *
 * This exists because neither a job nor a person carries a surveyed position.
 * A posting says "Dhanmondi, Dhaka"; an account says "House 12, Road 5,
 * Dhanmondi, Dhaka". To answer "how far is that", something has to turn those
 * words into a point, and the two honest ways to do it are a geocoding service
 * or a table like this one.
 *
 * A table was chosen deliberately. Geocoding 159 seeded postings against
 * Google needs a billed API key; against Nominatim it needs a minute of
 * rate-limited requests and a network round trip every time a job is posted.
 * A static gazetteer needs neither, never fails, is identical on every
 * machine, and can be checked by anyone who knows the country.
 *
 * What this costs is precision, and the app says so rather than hiding it.
 * Each entry is the centre of a named place, so a distance computed from it is
 * accurate to roughly the size of that place — a few hundred metres for a
 * Dhaka neighbourhood, a few kilometres for a rural district. Distances built
 * on it are shown with a "~" and never to more than one decimal. Anyone who
 * later adds real per-posting coordinates can keep every consumer of this file
 * and simply stop falling back to it.
 */

export type LatLng = { lat: number; lng: number };

export type BdPlace = LatLng & {
  /** The name as it appears in address and posting text. */
  name: string;
  /**
   * Roughly how far the centre can be from anywhere inside the place.
   *
   * Not used in the arithmetic — it is here so anyone reading a distance knows
   * the error bar they are looking at, and so a future radius filter can widen
   * itself honestly rather than pretending to metre accuracy.
   */
  spreadKm: number;
};

/**
 * Neighbourhoods first, then districts.
 *
 * Order matters: `resolvePlace` returns the first entry whose name appears in
 * the text, and "Dhanmondi, Dhaka" contains both "Dhanmondi" and "Dhaka". The
 * finer place is the better answer, so the finer places are listed first.
 */
export const BD_PLACES: readonly BdPlace[] = [
  // --- Dhaka city, finest first ---
  { name: 'Dhanmondi', lat: 23.7461, lng: 90.3742, spreadKm: 1.5 },
  { name: 'Gulshan', lat: 23.7925, lng: 90.4078, spreadKm: 1.5 },
  { name: 'Banani', lat: 23.7937, lng: 90.4066, spreadKm: 1.2 },
  { name: 'Mohammadpur', lat: 23.7592, lng: 90.3588, spreadKm: 2 },
  { name: 'Mirpur', lat: 23.8223, lng: 90.3654, spreadKm: 3 },
  { name: 'Uttara', lat: 23.8759, lng: 90.3795, spreadKm: 3 },
  { name: 'Bashundhara', lat: 23.8203, lng: 90.4272, spreadKm: 2 },
  { name: 'Badda', lat: 23.7806, lng: 90.4258, spreadKm: 2 },
  { name: 'Tejgaon', lat: 23.7639, lng: 90.3927, spreadKm: 1.5 },
  { name: 'Farmgate', lat: 23.7583, lng: 90.3897, spreadKm: 1 },
  { name: 'Motijheel', lat: 23.733, lng: 90.4172, spreadKm: 1.5 },
  { name: 'Khilgaon', lat: 23.75, lng: 90.4256, spreadKm: 2 },
  { name: 'Jatrabari', lat: 23.7104, lng: 90.4348, spreadKm: 2 },
  { name: 'Keraniganj', lat: 23.7, lng: 90.3833, spreadKm: 4 },
  { name: 'Savar', lat: 23.8583, lng: 90.2667, spreadKm: 5 },
  { name: 'Tongi', lat: 23.8917, lng: 90.4033, spreadKm: 3 },

  // --- other city neighbourhoods that appear in postings ---
  { name: 'Agrabad', lat: 22.3269, lng: 91.8123, spreadKm: 2 },
  { name: 'Zindabazar', lat: 24.8949, lng: 91.8687, spreadKm: 1.5 },

  // --- the 64 district towns ---
  { name: 'Dhaka', lat: 23.8103, lng: 90.4125, spreadKm: 10 },
  { name: 'Gazipur', lat: 23.9999, lng: 90.4203, spreadKm: 8 },
  { name: 'Narayanganj', lat: 23.6238, lng: 90.5, spreadKm: 6 },
  { name: 'Narsingdi', lat: 23.9322, lng: 90.715, spreadKm: 6 },
  { name: 'Munshiganj', lat: 23.5422, lng: 90.5305, spreadKm: 6 },
  { name: 'Manikganj', lat: 23.8617, lng: 90.0003, spreadKm: 6 },
  { name: 'Tangail', lat: 24.2513, lng: 89.9167, spreadKm: 8 },
  { name: 'Kishoreganj', lat: 24.4449, lng: 90.7766, spreadKm: 8 },
  { name: 'Faridpur', lat: 23.607, lng: 89.8429, spreadKm: 7 },
  { name: 'Gopalganj', lat: 23.005, lng: 89.8266, spreadKm: 7 },
  { name: 'Madaripur', lat: 23.1641, lng: 90.1897, spreadKm: 6 },
  { name: 'Shariatpur', lat: 23.2423, lng: 90.4348, spreadKm: 6 },
  { name: 'Rajbari', lat: 23.7574, lng: 89.6445, spreadKm: 6 },

  { name: 'Chattogram', lat: 22.3569, lng: 91.7832, spreadKm: 10 },
  { name: "Cox's Bazar", lat: 21.4272, lng: 92.0058, spreadKm: 8 },
  { name: 'Cumilla', lat: 23.4607, lng: 91.1809, spreadKm: 8 },
  { name: 'Comilla', lat: 23.4607, lng: 91.1809, spreadKm: 8 },
  { name: 'Brahmanbaria', lat: 23.9571, lng: 91.1119, spreadKm: 7 },
  { name: 'Chandpur', lat: 23.2333, lng: 90.6667, spreadKm: 7 },
  { name: 'Feni', lat: 23.0159, lng: 91.3976, spreadKm: 6 },
  { name: 'Lakshmipur', lat: 22.9447, lng: 90.8282, spreadKm: 6 },
  { name: 'Noakhali', lat: 22.8696, lng: 91.0995, spreadKm: 8 },
  { name: 'Rangamati', lat: 22.6533, lng: 92.175, spreadKm: 12 },
  { name: 'Bandarban', lat: 22.1953, lng: 92.2184, spreadKm: 14 },
  { name: 'Khagrachhari', lat: 23.1193, lng: 91.9847, spreadKm: 12 },

  { name: 'Sylhet', lat: 24.8949, lng: 91.8687, spreadKm: 9 },
  { name: 'Moulvibazar', lat: 24.4829, lng: 91.7774, spreadKm: 8 },
  { name: 'Habiganj', lat: 24.3745, lng: 91.4155, spreadKm: 8 },
  { name: 'Sunamganj', lat: 25.0658, lng: 91.395, spreadKm: 9 },

  { name: 'Rajshahi', lat: 24.3745, lng: 88.6042, spreadKm: 8 },
  { name: 'Bogura', lat: 24.8465, lng: 89.3773, spreadKm: 8 },
  { name: 'Bogra', lat: 24.8465, lng: 89.3773, spreadKm: 8 },
  { name: 'Pabna', lat: 24.0064, lng: 89.2372, spreadKm: 8 },
  { name: 'Sirajganj', lat: 24.4534, lng: 89.7007, spreadKm: 8 },
  { name: 'Natore', lat: 24.4206, lng: 89.0003, spreadKm: 7 },
  { name: 'Naogaon', lat: 24.7936, lng: 88.9318, spreadKm: 8 },
  { name: 'Joypurhat', lat: 25.0968, lng: 89.0227, spreadKm: 6 },
  { name: 'Chapainawabganj', lat: 24.5965, lng: 88.2775, spreadKm: 7 },

  { name: 'Khulna', lat: 22.8456, lng: 89.5403, spreadKm: 9 },
  { name: 'Jashore', lat: 23.1664, lng: 89.2081, spreadKm: 8 },
  { name: 'Jessore', lat: 23.1664, lng: 89.2081, spreadKm: 8 },
  { name: 'Satkhira', lat: 22.7185, lng: 89.0705, spreadKm: 8 },
  { name: 'Bagerhat', lat: 22.6516, lng: 89.7859, spreadKm: 8 },
  { name: 'Narail', lat: 23.1725, lng: 89.5122, spreadKm: 6 },
  { name: 'Magura', lat: 23.4855, lng: 89.4198, spreadKm: 6 },
  { name: 'Jhenaidah', lat: 23.545, lng: 89.1726, spreadKm: 7 },
  { name: 'Kushtia', lat: 23.9013, lng: 89.1206, spreadKm: 7 },
  { name: 'Chuadanga', lat: 23.6402, lng: 88.8412, spreadKm: 6 },
  { name: 'Meherpur', lat: 23.7622, lng: 88.6318, spreadKm: 6 },

  { name: 'Barishal', lat: 22.701, lng: 90.3535, spreadKm: 8 },
  { name: 'Barisal', lat: 22.701, lng: 90.3535, spreadKm: 8 },
  { name: 'Patuakhali', lat: 22.3596, lng: 90.3298, spreadKm: 8 },
  { name: 'Bhola', lat: 22.6859, lng: 90.6482, spreadKm: 10 },
  { name: 'Pirojpur', lat: 22.5841, lng: 89.972, spreadKm: 7 },
  { name: 'Jhalokati', lat: 22.6406, lng: 90.1987, spreadKm: 6 },
  { name: 'Barguna', lat: 22.0953, lng: 90.1121, spreadKm: 7 },

  { name: 'Rangpur', lat: 25.7439, lng: 89.2752, spreadKm: 8 },
  { name: 'Dinajpur', lat: 25.6217, lng: 88.6354, spreadKm: 9 },
  { name: 'Nilphamari', lat: 25.931, lng: 88.856, spreadKm: 7 },
  { name: 'Lalmonirhat', lat: 25.9923, lng: 89.2847, spreadKm: 7 },
  { name: 'Kurigram', lat: 25.8072, lng: 89.6295, spreadKm: 8 },
  { name: 'Gaibandha', lat: 25.3288, lng: 89.5281, spreadKm: 8 },
  { name: 'Thakurgaon', lat: 26.0337, lng: 88.4616, spreadKm: 8 },
  { name: 'Panchagarh', lat: 26.3411, lng: 88.5542, spreadKm: 8 },

  { name: 'Mymensingh', lat: 24.7471, lng: 90.4203, spreadKm: 9 },
  { name: 'Jamalpur', lat: 24.9375, lng: 89.9372, spreadKm: 8 },
  { name: 'Netrokona', lat: 24.8103, lng: 90.8695, spreadKm: 8 },
  { name: 'Sherpur', lat: 25.0204, lng: 90.0152, spreadKm: 7 },
];

/**
 * The finest place named anywhere in the given text.
 *
 * Substring rather than exact match, because the strings this reads are prose
 * a person typed: "House 12, Road 5, Dhanmondi, Dhaka", "Tongi, Gazipur",
 * "Zindabazar, Sylhet". Word boundaries keep "Feni" out of "Fenchuganj" and
 * "Bhola" out of "Bholahat".
 */
export function resolvePlace(text: string | null | undefined): BdPlace | null {
  if (!text) return null;
  const haystack = text.toLowerCase();
  return (
    BD_PLACES.find((place) => {
      const name = place.name.toLowerCase();
      const at = haystack.indexOf(name);
      if (at === -1) return false;
      const before = at === 0 ? ' ' : haystack[at - 1]!;
      const after = haystack[at + name.length] ?? ' ';
      return !/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after);
    }) ?? null
  );
}

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Great-circle distance in kilometres.
 *
 * Haversine rather than a flat approximation: the difference is small over
 * Bangladesh, but the formula is three lines and this way the function is
 * correct anywhere rather than only near the equator.
 */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
