import { z } from 'zod';

/**
 * Bangladesh's administrative divisions and districts.
 *
 * Static reference data, like the job categories — the country's eight
 * divisions and sixty-four districts do not change on a release cadence, and
 * putting them in a table would mean a query for something every filter row
 * needs immediately.
 *
 * Upazilas/thanas are deliberately absent. There are roughly five hundred of
 * them, they would triple this file, and the free-text search box already
 * matches a posting's area against what the recruiter typed — which is how
 * someone actually looks for work in Mirpur rather than "Dhaka".
 */

export const divisionSchema = z.enum([
  'BARISHAL',
  'CHATTOGRAM',
  'DHAKA',
  'KHULNA',
  'MYMENSINGH',
  'RAJSHAHI',
  'RANGPUR',
  'SYLHET',
]);
export type Division = z.infer<typeof divisionSchema>;

export interface DivisionInfo {
  key: Division;
  en: string;
  bn: string;
  districts: readonly { en: string; bn: string }[];
}

export const DIVISIONS: readonly DivisionInfo[] = [
  {
    key: 'BARISHAL',
    en: 'Barishal',
    bn: 'বরিশাল',
    districts: [
      { en: 'Barguna', bn: 'বরগুনা' },
      { en: 'Barishal', bn: 'বরিশাল' },
      { en: 'Bhola', bn: 'ভোলা' },
      { en: 'Jhalokati', bn: 'ঝালকাঠি' },
      { en: 'Patuakhali', bn: 'পটুয়াখালী' },
      { en: 'Pirojpur', bn: 'পিরোজপুর' },
    ],
  },
  {
    key: 'CHATTOGRAM',
    en: 'Chattogram',
    bn: 'চট্টগ্রাম',
    districts: [
      { en: 'Bandarban', bn: 'বান্দরবান' },
      { en: 'Brahmanbaria', bn: 'ব্রাহ্মণবাড়িয়া' },
      { en: 'Chandpur', bn: 'চাঁদপুর' },
      { en: 'Chattogram', bn: 'চট্টগ্রাম' },
      { en: "Cox's Bazar", bn: 'কক্সবাজার' },
      { en: 'Cumilla', bn: 'কুমিল্লা' },
      { en: 'Feni', bn: 'ফেনী' },
      { en: 'Khagrachhari', bn: 'খাগড়াছড়ি' },
      { en: 'Lakshmipur', bn: 'লক্ষ্মীপুর' },
      { en: 'Noakhali', bn: 'নোয়াখালী' },
      { en: 'Rangamati', bn: 'রাঙ্গামাটি' },
    ],
  },
  {
    key: 'DHAKA',
    en: 'Dhaka',
    bn: 'ঢাকা',
    districts: [
      { en: 'Dhaka', bn: 'ঢাকা' },
      { en: 'Faridpur', bn: 'ফরিদপুর' },
      { en: 'Gazipur', bn: 'গাজীপুর' },
      { en: 'Gopalganj', bn: 'গোপালগঞ্জ' },
      { en: 'Kishoreganj', bn: 'কিশোরগঞ্জ' },
      { en: 'Madaripur', bn: 'মাদারীপুর' },
      { en: 'Manikganj', bn: 'মানিকগঞ্জ' },
      { en: 'Munshiganj', bn: 'মুন্সিগঞ্জ' },
      { en: 'Narayanganj', bn: 'নারায়ণগঞ্জ' },
      { en: 'Narsingdi', bn: 'নরসিংদী' },
      { en: 'Rajbari', bn: 'রাজবাড়ী' },
      { en: 'Shariatpur', bn: 'শরীয়তপুর' },
      { en: 'Tangail', bn: 'টাঙ্গাইল' },
    ],
  },
  {
    key: 'KHULNA',
    en: 'Khulna',
    bn: 'খুলনা',
    districts: [
      { en: 'Bagerhat', bn: 'বাগেরহাট' },
      { en: 'Chuadanga', bn: 'চুয়াডাঙ্গা' },
      { en: 'Jashore', bn: 'যশোর' },
      { en: 'Jhenaidah', bn: 'ঝিনাইদহ' },
      { en: 'Khulna', bn: 'খুলনা' },
      { en: 'Kushtia', bn: 'কুষ্টিয়া' },
      { en: 'Magura', bn: 'মাগুরা' },
      { en: 'Meherpur', bn: 'মেহেরপুর' },
      { en: 'Narail', bn: 'নড়াইল' },
      { en: 'Satkhira', bn: 'সাতক্ষীরা' },
    ],
  },
  {
    key: 'MYMENSINGH',
    en: 'Mymensingh',
    bn: 'ময়মনসিংহ',
    districts: [
      { en: 'Jamalpur', bn: 'জামালপুর' },
      { en: 'Mymensingh', bn: 'ময়মনসিংহ' },
      { en: 'Netrokona', bn: 'নেত্রকোণা' },
      { en: 'Sherpur', bn: 'শেরপুর' },
    ],
  },
  {
    key: 'RAJSHAHI',
    en: 'Rajshahi',
    bn: 'রাজশাহী',
    districts: [
      { en: 'Bogura', bn: 'বগুড়া' },
      { en: 'Chapainawabganj', bn: 'চাঁপাইনবাবগঞ্জ' },
      { en: 'Joypurhat', bn: 'জয়পুরহাট' },
      { en: 'Naogaon', bn: 'নওগাঁ' },
      { en: 'Natore', bn: 'নাটোর' },
      { en: 'Pabna', bn: 'পাবনা' },
      { en: 'Rajshahi', bn: 'রাজশাহী' },
      { en: 'Sirajganj', bn: 'সিরাজগঞ্জ' },
    ],
  },
  {
    key: 'RANGPUR',
    en: 'Rangpur',
    bn: 'রংপুর',
    districts: [
      { en: 'Dinajpur', bn: 'দিনাজপুর' },
      { en: 'Gaibandha', bn: 'গাইবান্ধা' },
      { en: 'Kurigram', bn: 'কুড়িগ্রাম' },
      { en: 'Lalmonirhat', bn: 'লালমনিরহাট' },
      { en: 'Nilphamari', bn: 'নীলফামারী' },
      { en: 'Panchagarh', bn: 'পঞ্চগড়' },
      { en: 'Rangpur', bn: 'রংপুর' },
      { en: 'Thakurgaon', bn: 'ঠাকুরগাঁও' },
    ],
  },
  {
    key: 'SYLHET',
    en: 'Sylhet',
    bn: 'সিলেট',
    districts: [
      { en: 'Habiganj', bn: 'হবিগঞ্জ' },
      { en: 'Moulvibazar', bn: 'মৌলভীবাজার' },
      { en: 'Sunamganj', bn: 'সুনামগঞ্জ' },
      { en: 'Sylhet', bn: 'সিলেট' },
    ],
  },
] as const;

export const DIVISION_BY_KEY: Record<Division, DivisionInfo> =
  Object.fromEntries(DIVISIONS.map((d) => [d.key, d])) as Record<
    Division,
    DivisionInfo
  >;

export function divisionName(key: Division, locale: 'en' | 'bn'): string {
  const info = DIVISION_BY_KEY[key];
  return locale === 'bn' ? info.bn : info.en;
}

/** Districts are stored by their English name, which is the stable key. */
export function districtsOf(key: Division): readonly { en: string; bn: string }[] {
  return DIVISION_BY_KEY[key].districts;
}
