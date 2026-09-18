import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ComplaintStatus,
  ReplyAuthor,
  UserNotificationKind,
} from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { UserNotificationsService } from '../common/user-notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SendSupportMessageDto } from './dto/support.dto';

/**
 * Item 9 — "help option a … jokhon user kono mesg ba text dibe seitar rply
 * sate sate korbe".
 *
 * Support used to be one-directional: a Complaint row existed, an admin could
 * reply to it, and the person who wrote in heard nothing until someone was at
 * a desk. Now a user message is answered in the same request that creates it:
 *
 *   1. the message is stored as a USER reply on the ticket (new tickets get
 *      created first, follow-ups attach to the existing thread)
 *   2. an answer is composed immediately — a published FAQ block if one
 *      matches the wording, otherwise an acknowledgement that states the
 *      ticket code and what happens next
 *   3. that answer is stored as a SYSTEM reply *and* pushed to the user as a
 *      UserNotification, which is what makes the popup appear on their screen
 *      the moment the message lands (the app polls for unread ones)
 *
 * The auto-reply never closes the ticket, and never claims the problem is
 * solved — it answers if it can and otherwise says a person is coming. An
 * admin reply later in the thread goes out through the same notification
 * path, so the popup behaves identically whether a bot or a human answered.
 */
@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly userNotifications: UserNotificationsService,
  ) {}

  async sendMessage(dto: SendSupportMessageDto) {
    const message = dto.message.trim();

    const complaint = dto.complaintId
      ? await this.existingThread(dto.complaintId)
      : await this.openThread(dto, message);

    // The user's own words go into the thread so an admin reads the
    // conversation in order rather than just the opening subject.
    if (dto.complaintId) {
      await this.prisma.complaintReply.create({
        data: {
          complaintId: complaint.id,
          authorType: ReplyAuthor.USER,
          authorName: complaint.reporterName,
          message,
        },
      });

      // A follow-up on a ticket someone had already closed reopens it —
      // otherwise the reply would sit unread against a RESOLVED ticket.
      if (complaint.status === ComplaintStatus.RESOLVED || complaint.status === ComplaintStatus.CLOSED) {
        await this.prisma.complaint.update({
          where: { id: complaint.id },
          data: { status: ComplaintStatus.OPEN, resolvedAt: null },
        });
      }
    }

    const answer = await this.composeAnswer(message, complaint.code);

    const reply = await this.prisma.complaintReply.create({
      data: {
        complaintId: complaint.id,
        authorType: ReplyAuthor.SYSTEM,
        authorName: 'WorkFlex Support',
        message: answer.text,
        auto: true,
      },
    });

    await this.prisma.complaint.update({
      where: { id: complaint.id },
      data: { autoRepliedAt: new Date() },
    });

    // This is the row the user's app turns into a popup.
    await this.userNotifications.send({
      kind: UserNotificationKind.SUPPORT_REPLY,
      workerId: complaint.reporterWorkerId,
      employerId: complaint.reporterEmployerId,
      title: answer.matched ? 'Support answered your question' : `We got your message (${complaint.code})`,
      body: answer.text,
      entityType: 'Complaint',
      entityId: complaint.id,
    });

    // And the admin feed learns a new ticket is waiting.
    if (!dto.complaintId) {
      await this.prisma.notification.create({
        data: {
          kind: 'SOS',
          title: `New support message: ${complaint.subject}`,
          body: `${complaint.code} from ${complaint.reporterName}`,
        },
      });
    }

    return {
      complaintId: complaint.id,
      code: complaint.code,
      status: complaint.status,
      autoReply: { id: reply.id, message: answer.text, matchedFaq: answer.matched, createdAt: reply.createdAt },
    };
  }

  private async existingThread(complaintId: string) {
    const complaint = await this.prisma.complaint.findUnique({ where: { id: complaintId } });
    if (!complaint) throw new NotFoundException('That support ticket no longer exists.');
    return complaint;
  }

  private async openThread(dto: SendSupportMessageDto, message: string) {
    const code = await this.nextCode();
    return this.prisma.complaint.create({
      data: {
        code,
        // A first line long enough to scan in the queue, without cutting a
        // short message in half.
        subject: dto.subject?.trim() || message.slice(0, 80) + (message.length > 80 ? '…' : ''),
        body: message,
        reporterName: dto.reporterName?.trim() || 'App user',
        reporterWorkerId: dto.workerId ?? null,
        reporterEmployerId: dto.employerId ?? null,
      },
    });
  }

  /// Same highest-code-in-use approach used for job and transaction codes, so
  /// a deleted ticket can't make the next one collide.
  private async nextCode(): Promise<string> {
    const last = await this.prisma.complaint.findFirst({
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    const lastNumber = last ? Number(last.code.split('-')[1]) : 0;
    const next = Number.isFinite(lastNumber) ? lastNumber + 1 : 1;
    return `TKT-${String(next).padStart(4, '0')}`;
  }

  /**
   * The answer itself. Published FAQ blocks in the CMS are the knowledge
   * base — an admin adding an FAQ improves the auto-reply with no code
   * change. Matching is deliberately simple word overlap rather than anything
   * statistical: it has to run inside the request, and a wrong-but-confident
   * answer is worse than an honest acknowledgement, so a weak match falls
   * through to the acknowledgement instead.
   */
  private async composeAnswer(message: string, code: string) {
    const faqs = await this.prisma.cmsBlock.findMany({
      where: { kind: 'FAQ', published: true },
      select: { title: true, body: true },
    });

    const words = this.keywords(message);
    let best: { score: number; body: string } | null = null;

    for (const faq of faqs) {
      if (!faq.body) continue;
      const haystack = this.keywords(`${faq.title} ${faq.body}`);
      const score = words.filter((w) => haystack.includes(w)).length;
      if (score >= 2 && (!best || score > best.score)) {
        best = { score, body: faq.body };
      }
    }

    if (best) {
      return {
        matched: true,
        text:
          `${best.body}\n\n` +
          `If that does not solve it, reply here and a support agent will pick it up. ` +
          `Your reference is ${code}.`,
      };
    }

    return {
      matched: false,
      text:
        `Thanks — we have your message and opened ticket ${code} for it. ` +
        `A support agent will reply here, and you will get a notification as soon as they do. ` +
        `If anything changes in the meantime, just reply to this message.`,
    };
  }

  /// Words worth matching on: lowercase, 4+ characters, de-duplicated.
  private keywords(value: string): string[] {
    return [
      ...new Set(
        value
          .toLowerCase()
          .replace(/[^a-z0-9\u0980-\u09FF\s]/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length >= 4),
      ),
    ];
  }
}
