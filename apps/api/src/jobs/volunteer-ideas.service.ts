import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
// zod/v4, not the package root: zodOutputFormat is typed against v4 while the
// rest of the repo is on the v3 API — the same split the CV writer lives with.
import * as z from 'zod/v4';
import type { VolunteerIdea, VolunteerIdeas } from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import type { Env } from '../config/env.schema';

const MOST = 6;

const ideaSchema = z.object({
  title: z
    .string()
    .describe('What to search for — "Blood donation camp", not an event name.'),
  organisers: z
    .string()
    .describe('The kind of body that runs these here. Empty if not known.'),
  why: z
    .string()
    .describe("One line tying it to this person's own skills or trade."),
});

const SYSTEM = `You suggest volunteering and community work to people in
Bangladesh — drivers, cleaners, kitchen staff, students, tutors, guards, shop
workers, office workers.

You are given the skills on their CV and the area they live in. Suggest kinds
of volunteering that would suit them and are common in Bangladesh.

Rules you do not break:

1. Never name a specific event, date or venue. You do not know what is on
   this week, and somebody will travel to whatever you write down. Suggest
   the kind of thing — "blood donation camp", "flood relief packing" — and
   the app turns it into a search that finds what is actually happening.
2. Only suggest what a person can realistically reach: things that happen in
   Bangladeshi neighbourhoods, mosques, schools, clubs, hospitals and NGOs.
   Not internships abroad, not remote work for foreign charities.
3. "why" points at something they can already do — "you already cook for
   large numbers" — not at how rewarding volunteering is.
4. Name the kind of organiser where it is genuinely typical (Red Crescent,
   local mosque committees, schools, hospital blood banks). Leave it empty
   rather than inventing an organisation.
5. Nothing that asks them to pay a fee, hand over documents, or travel far at
   their own cost. These are people who count bus fare.
6. Write in the language asked for.`;

/**
 * The ideas half of the volunteer board.
 *
 * The other half — real postings in the volunteer category — comes from the
 * jobs feed and needs no model at all. This is for what is happening outside
 * the platform, and it deliberately produces searches rather than events: see
 * the note in shared/volunteering.ts for why that distinction matters here
 * more than anywhere else in the app.
 */
@Injectable()
export class VolunteerIdeasService {
  private readonly logger = new Logger(VolunteerIdeasService.name);
  private readonly client: Anthropic | null;
  private readonly model: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {
    const enabled = this.config.get('CV_PARSER', { infer: true }) === 'claude';
    const apiKey = this.config.get('ANTHROPIC_API_KEY', { infer: true });
    this.model = this.config.get('CV_PARSER_MODEL', { infer: true });

    this.client = enabled && apiKey ? new Anthropic({ apiKey }) : null;
    if (!this.client) {
      this.logger.warn('Volunteer ideas are off — the standing list will be used');
    }
  }

  async ideas(userId: string): Promise<VolunteerIdeas> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        locale: true,
        address: true,
        cvProfile: { select: { skills: true, titles: true } },
      },
    });

    const language = user?.locale === 'en' ? 'en' : 'bn';
    const area = user?.address?.trim() || (language === 'bn' ? 'বাংলাদেশ' : 'Bangladesh');
    const skills = user?.cvProfile?.skills ?? [];

    const assembled = STANDING[language].map((idea) => ({
      ...idea,
      searchUrl: searchUrl(idea.title, area),
    }));

    if (!this.client) return { ideas: assembled, area, source: 'assembled' };

    const written = await this.write({ area, skills, titles: user?.cvProfile?.titles ?? [], language });
    return written
      ? { ideas: written.map((idea) => ({ ...idea, searchUrl: searchUrl(idea.title, area) })), area, source: 'written' }
      : { ideas: assembled, area, source: 'assembled' };
  }

  private async write(input: {
    area: string;
    skills: string[];
    titles: string[];
    language: 'en' | 'bn';
  }): Promise<Omit<VolunteerIdea, 'searchUrl'>[] | null> {
    try {
      const response = await this.client!.messages.parse({
        model: this.model,
        max_tokens: 1200,
        output_config: {
          effort: 'low',
          format: zodOutputFormat(z.object({ ideas: z.array(ideaSchema) })),
        },
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: [
              `Suggest up to ${MOST} kinds of volunteering, in ${
                input.language === 'bn' ? 'Bangla' : 'English'
              }.`,
              `They live in or near: ${input.area}`,
              `What they do: ${input.titles.join(', ') || 'not known'}`,
              `What they can do: ${input.skills.join(', ') || 'not known'}`,
            ].join('\n'),
          },
        ],
      });

      if (response.stop_reason === 'refusal') return null;
      const ideas = response.parsed_output?.ideas ?? [];
      if (ideas.length === 0) return null;

      return ideas.slice(0, MOST).map((idea) => ({
        title: idea.title.trim(),
        organisers: idea.organisers.trim(),
        why: idea.why.trim(),
      }));
    } catch (err) {
      this.logger.error(
        `Volunteer ideas failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}

/**
 * The list when there is no model: six kinds of volunteering that happen
 * across Bangladesh all year, with the bodies that usually run them.
 *
 * Not a degraded version of the model's answer. These are the things a person
 * in Dhaka or Khulna can actually turn up to, and the search is what finds
 * the one happening this weekend.
 */
const STANDING: Record<'en' | 'bn', Omit<VolunteerIdea, 'searchUrl'>[]> = {
  en: [
    {
      title: 'Blood donation camp',
      organisers: 'Red Crescent, Sandhani, hospital blood banks',
      why: 'Camps need people at the desk and on the door as much as donors.',
    },
    {
      title: 'Free tutoring for children',
      organisers: 'Local schools, madrasas, community coaching centres',
      why: 'An hour a week of reading or maths with children who have nobody to ask.',
    },
    {
      title: 'Flood and disaster relief packing',
      organisers: 'Red Crescent, BRAC, local mosque committees',
      why: 'Packing and loading relief goods — steady hands, no training needed.',
    },
    {
      title: 'Community clean-up drive',
      organisers: 'Ward councillors, youth clubs, environmental groups',
      why: 'A morning clearing a street or a canal bank with a group from the area.',
    },
    {
      title: 'Iftar and food distribution',
      organisers: 'Mosque committees, charitable kitchens',
      why: 'Cooking and serving in numbers, which is a real skill in a kitchen line.',
    },
    {
      title: 'Elderly and orphanage visiting',
      organisers: 'Old age homes, orphanages, local welfare societies',
      why: 'Company, errands and help at mealtimes for people who see few visitors.',
    },
  ],
  bn: [
    {
      title: 'রক্তদান ক্যাম্প',
      organisers: 'রেড ক্রিসেন্ট, সন্ধানী, হাসপাতালের ব্লাড ব্যাংক',
      why: 'ক্যাম্পে রক্তদাতার মতোই দরকার হয় টেবিলে আর গেটে দাঁড়ানোর লোক।',
    },
    {
      title: 'শিশুদের বিনামূল্যে পড়ানো',
      organisers: 'স্থানীয় স্কুল, মাদ্রাসা, কমিউনিটি কোচিং',
      why: 'সপ্তাহে এক ঘণ্টা পড়া বা অঙ্ক — যাদের জিজ্ঞেস করার কেউ নেই তাদের সঙ্গে।',
    },
    {
      title: 'বন্যা ও দুর্যোগে ত্রাণ প্যাকিং',
      organisers: 'রেড ক্রিসেন্ট, ব্র্যাক, স্থানীয় মসজিদ কমিটি',
      why: 'ত্রাণ গোছানো ও তোলা-নামানো — আলাদা প্রশিক্ষণ লাগে না।',
    },
    {
      title: 'এলাকা পরিষ্কার অভিযান',
      organisers: 'ওয়ার্ড কাউন্সিলর, যুব ক্লাব, পরিবেশ সংগঠন',
      why: 'এক সকাল এলাকার রাস্তা বা খালপাড় পরিষ্কার, দলবেঁধে।',
    },
    {
      title: 'ইফতার ও খাবার বিতরণ',
      organisers: 'মসজিদ কমিটি, দাতব্য রান্নাঘর',
      why: 'অনেক মানুষের জন্য রান্না ও পরিবেশন — রান্নাঘরের আসল দক্ষতা।',
    },
    {
      title: 'বৃদ্ধাশ্রম ও এতিমখানায় সময় দেওয়া',
      organisers: 'বৃদ্ধাশ্রম, এতিমখানা, স্থানীয় কল্যাণ সমিতি',
      why: 'যাঁদের কাছে কেউ আসে না, তাঁদের সঙ্গ, কাজ এগিয়ে দেওয়া আর খাওয়ার সময়ে সাহায্য।',
    },
  ],
};

/**
 * The link on every card: a search, run where the person is.
 *
 * Scoped to their area so the results are reachable, and built here rather
 * than by the model — see rule 1 of the prompt.
 */
function searchUrl(title: string, area: string): string {
  const query = [title, area, 'volunteer'].filter(Boolean).join(' ');
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}
