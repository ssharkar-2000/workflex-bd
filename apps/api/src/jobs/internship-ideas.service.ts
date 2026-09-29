import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
// zod/v4, not the package root: see the note in cv-writer.service.ts.
import * as z from 'zod/v4';
import type { InternshipIdea, InternshipIdeas } from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import type { Env } from '../config/env.schema';

const MOST = 6;

const ideaSchema = z.object({
  title: z.string().describe('The kind of placement, not a named vacancy.'),
  employers: z.string().describe('The sort of organisation that runs them. May be empty.'),
  why: z.string().describe('What a graduate gets from it. One line, no encouragement.'),
  asksFor: z.string().describe('What it usually requires — a degree, a subject, a skill.'),
});

const SYSTEM = `You suggest internships to people in Bangladesh who have just
finished studying — a BBA, a BSc, a diploma, an honours degree, or school.

You are given what their CV says and where they live. Suggest the kinds of
internship they could realistically get.

Rules you do not break:

1. Never name a specific vacancy, company programme intake or deadline. You
   do not know what is open this month; the app turns your suggestion into a
   search that finds what is. A graduate who applies to a programme that
   closed in March loses a day and some confidence.
2. Only what exists in Bangladesh and takes people at their level. No
   placements abroad, nothing requiring a master's from overseas, nothing
   that needs experience a fresh graduate cannot have.
3. Say plainly what it asks for. "Most ask for a BBA and Excel" is the useful
   sentence; "a great opportunity to grow" is not.
4. Never suggest anything that charges a fee, asks for a security deposit, or
   is unpaid full-time for months on end. Unpaid internships price out
   exactly the people this platform is for — if a kind of placement is
   usually unpaid, say so in "asksFor" so they can decide.
5. Name the sort of employer only where it is genuinely typical — banks,
   NGOs, garment buying houses, software firms, hospitals. Leave it empty
   rather than inventing a company.
6. Write in the language asked for.`;

/**
 * The ideas half of the internship board.
 *
 * Real postings come from the jobs feed filtered to internships and need no
 * model. This covers everything advertised outside the platform, as searches
 * rather than listings — the same rule as the volunteer board, and it matters
 * as much here: internship intakes open and close on their own calendar.
 */
@Injectable()
export class InternshipIdeasService {
  private readonly logger = new Logger(InternshipIdeasService.name);
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
      this.logger.warn('Internship ideas are off — the standing list will be used');
    }
  }

  async ideas(userId: string): Promise<InternshipIdeas> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        locale: true,
        address: true,
        cvProfile: { select: { skills: true, titles: true, summary: true } },
      },
    });

    const language = user?.locale === 'en' ? 'en' : 'bn';
    const area = user?.address?.trim() || (language === 'bn' ? 'বাংলাদেশ' : 'Bangladesh');

    const assembled = STANDING[language].map((idea) => ({
      ...idea,
      searchUrl: searchUrl(idea.title, area),
    }));

    if (!this.client) return { ideas: assembled, area, source: 'assembled' };

    const written = await this.write({
      area,
      language,
      skills: user?.cvProfile?.skills ?? [],
      titles: user?.cvProfile?.titles ?? [],
    });

    return written
      ? {
          ideas: written.map((idea) => ({ ...idea, searchUrl: searchUrl(idea.title, area) })),
          area,
          source: 'written',
        }
      : { ideas: assembled, area, source: 'assembled' };
  }

  private async write(input: {
    area: string;
    language: 'en' | 'bn';
    skills: string[];
    titles: string[];
  }): Promise<Omit<InternshipIdea, 'searchUrl'>[] | null> {
    try {
      const response = await this.client!.messages.parse({
        model: this.model,
        max_tokens: 1300,
        output_config: {
          effort: 'low',
          format: zodOutputFormat(z.object({ ideas: z.array(ideaSchema) })),
        },
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: [
              `Suggest up to ${MOST} kinds of internship, in ${
                input.language === 'bn' ? 'Bangla' : 'English'
              }.`,
              `They live in or near: ${input.area}`,
              `What they studied or did: ${input.titles.join(', ') || 'not known'}`,
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
        employers: idea.employers.trim(),
        why: idea.why.trim(),
        asksFor: idea.asksFor.trim(),
      }));
    } catch (err) {
      this.logger.error(
        `Internship ideas failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}

/**
 * The list when there is no model: six kinds of placement that Bangladeshi
 * graduates actually get, with what each one asks for.
 */
const STANDING: Record<'en' | 'bn', Omit<InternshipIdea, 'searchUrl'>[]> = {
  en: [
    {
      title: 'Bank internship',
      employers: 'Commercial banks, MFIs',
      why: 'Three months on a branch floor, and a certificate employers recognise.',
      asksFor: 'Usually a BBA or economics degree. Often a small stipend.',
    },
    {
      title: 'NGO programme internship',
      employers: 'BRAC, Grameen, ActionAid, smaller local NGOs',
      why: 'Fieldwork and report writing — the two things entry-level job ads ask for.',
      asksFor: 'Any honours degree. Field placements often pay travel.',
    },
    {
      title: 'Garments merchandising internship',
      employers: 'Buying houses and RMG factories',
      why: 'The industry that does most of the hiring in this country.',
      asksFor: 'Any degree, English, and Excel. Usually paid.',
    },
    {
      title: 'Software or IT internship',
      employers: 'Dhaka software firms, startups',
      why: 'The fastest route from a CSE degree to work somebody pays for.',
      asksFor: 'Code you can show. A degree matters less than a project.',
    },
    {
      title: 'Digital marketing internship',
      employers: 'Agencies, e-commerce companies',
      why: 'Runs on skills you can learn free online before you apply.',
      asksFor: 'Social media and basic design. Stipend varies — ask first.',
    },
    {
      title: 'Hospital or clinic internship',
      employers: 'Private hospitals, diagnostic centres',
      why: 'Admissions, records and front desk work alongside clinical staff.',
      asksFor: 'A health or science background. Shift work.',
    },
  ],
  bn: [
    {
      title: 'ব্যাংক ইন্টার্নশিপ',
      employers: 'বাণিজ্যিক ব্যাংক, ক্ষুদ্রঋণ সংস্থা',
      why: 'ব্রাঞ্চে তিন মাস, আর নিয়োগদাতারা চেনেন এমন একটি সনদ।',
      asksFor: 'সাধারণত বিবিএ বা অর্থনীতি। প্রায়ই সামান্য ভাতা থাকে।',
    },
    {
      title: 'এনজিও প্রোগ্রাম ইন্টার্নশিপ',
      employers: 'ব্র্যাক, গ্রামীণ, অ্যাকশনএইড, স্থানীয় এনজিও',
      why: 'মাঠের কাজ আর রিপোর্ট লেখা — চাকরির বিজ্ঞাপনে এ দুটিই চাওয়া হয়।',
      asksFor: 'যেকোনো অনার্স ডিগ্রি। মাঠের কাজে যাতায়াত খরচ দেওয়া হয়।',
    },
    {
      title: 'গার্মেন্টস মার্চেন্ডাইজিং ইন্টার্নশিপ',
      employers: 'বায়িং হাউস ও পোশাক কারখানা',
      why: 'এ দেশে সবচেয়ে বেশি নিয়োগ যে খাতে হয়।',
      asksFor: 'যেকোনো ডিগ্রি, ইংরেজি ও এক্সেল। সাধারণত ভাতা থাকে।',
    },
    {
      title: 'সফটওয়্যার বা আইটি ইন্টার্নশিপ',
      employers: 'ঢাকার সফটওয়্যার প্রতিষ্ঠান, স্টার্টআপ',
      why: 'সিএসই ডিগ্রি থেকে বেতনের কাজে যাওয়ার দ্রুততম পথ।',
      asksFor: 'দেখানোর মতো কোড। ডিগ্রির চেয়ে প্রজেক্ট বেশি জরুরি।',
    },
    {
      title: 'ডিজিটাল মার্কেটিং ইন্টার্নশিপ',
      employers: 'এজেন্সি, ই-কমার্স প্রতিষ্ঠান',
      why: 'যে দক্ষতাগুলো আবেদনের আগেই অনলাইনে বিনামূল্যে শেখা যায়।',
      asksFor: 'সোশ্যাল মিডিয়া ও সাধারণ ডিজাইন। ভাতা ভিন্ন — আগেই জেনে নিন।',
    },
    {
      title: 'হাসপাতাল বা ক্লিনিক ইন্টার্নশিপ',
      employers: 'বেসরকারি হাসপাতাল, ডায়াগনস্টিক সেন্টার',
      why: 'ভর্তি, রেকর্ড ও রিসেপশনের কাজ, চিকিৎসাকর্মীদের সঙ্গে।',
      asksFor: 'স্বাস্থ্য বা বিজ্ঞান বিষয়ে পড়াশোনা। শিফটের কাজ।',
    },
  ],
};

/** A search, run where the person is — never a named vacancy. */
function searchUrl(title: string, area: string): string {
  const query = [title, area, 'apply'].filter(Boolean).join(' ');
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}
