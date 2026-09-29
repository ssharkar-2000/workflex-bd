import { EMPTY_DRAFT, type ResumeDraft } from './resume-draft';

/**
 * A finished CV, for the person looking at an empty one.
 *
 * "See example" answers the question the blank builder cannot: how much is
 * enough? Two jobs with three points each, a real summary, eight skills — a
 * CV this length is the target, and seeing one is faster than reading advice
 * about one.
 *
 * It is deliberately a kitchen supervisor in Dhaka rather than a software
 * engineer. The example someone is shown tells them who this tool is for, and
 * a developer's CV full of frameworks would quietly tell most of this
 * platform's users that it is not for them.
 */
export const RESUME_SAMPLE: ResumeDraft = {
  ...EMPTY_DRAFT,
  template: 'MODERN',
  accent: 'AUTO',
  fullName: 'Rahima Akter',
  headline: 'Kitchen supervisor',
  years: '6',
  phone: '01712 345678',
  email: 'rahima.akter@example.com',
  location: 'Banani, Dhaka',
  summary:
    'Kitchen supervisor with 6 years of experience in Dhaka restaurants and event catering. Runs a team of nine across two shifts, orders stock and keeps the kitchen to food safety rules.',
  experience: [
    {
      id: 'sample-exp-1',
      title: 'Kitchen supervisor',
      org: 'Star Kabab',
      place: 'Banani, Dhaka',
      from: '2022',
      to: 'now',
      detail:
        'Led a team of nine across two shifts and set the daily rota.\nOrdered stock weekly and cut waste by keeping to order sheets.\nKept the kitchen to food safety rules and passed every inspection.',
    },
    {
      id: 'sample-exp-2',
      title: 'Cook',
      org: 'Dhaka Event Catering',
      place: 'Dhaka',
      from: '2019',
      to: '2022',
      detail:
        'Prepared food to order for events of up to 300 guests.\nSet up and packed down kitchens on site.\nTrained four new kitchen helpers.',
    },
  ],
  education: [
    {
      id: 'sample-edu-1',
      title: 'Higher Secondary Certificate',
      org: 'Dhaka City College',
      place: 'Dhaka',
      from: '2015',
      to: '2017',
      detail: '',
    },
  ],
  projects: [
    {
      id: 'sample-proj-1',
      title: 'Wedding catering, 250 guests',
      org: 'Own work',
      place: 'Savar',
      from: '2024',
      to: '',
      detail:
        'Planned the menu, bought the stock and ran the kitchen with four helpers.',
    },
  ],
  certificates: [
    {
      id: 'sample-cert-1',
      title: 'Food safety and hygiene',
      org: 'BSTI training centre',
      place: '',
      from: '2023',
      to: '',
      detail: '',
    },
  ],
  skills: [
    'Food safety',
    'Rostering',
    'Stock control',
    'Team leading',
    'Menu planning',
    'Cost control',
    'Bulk cooking',
    'Kitchen hygiene',
  ],
  languages: ['বাংলা', 'English'],
};
