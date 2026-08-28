import { z } from 'zod';
import { ticketPrioritySchema, ticketStatusSchema } from './admin-sections';

/**
 * The reporter's half of support.
 *
 * `admin-sections.ts` owns the console's view — every ticket, who raised it,
 * and the reply box. This is what the person who raised it sees: their own
 * tickets and whatever came back, with none of the triage fields they have no
 * business setting. Priority in particular is deliberately absent: a reporter
 * marking their own ticket URGENT tells the queue nothing.
 */

export const createSupportTicketSchema = z.object({
  subject: z.string().trim().min(3, 'Give it a short subject').max(120),
  message: z.string().trim().min(10, 'Describe what happened').max(2000),
});
export type CreateSupportTicketDto = z.output<typeof createSupportTicketSchema>;

export const mySupportTicketSchema = z.object({
  id: z.string(),
  subject: z.string(),
  message: z.string(),
  status: ticketStatusSchema,
  priority: ticketPrioritySchema,
  /** Null until a staff member answers. */
  response: z.string().nullable(),
  createdAt: z.string(),
  resolvedAt: z.string().nullable(),
});
export type MySupportTicket = z.infer<typeof mySupportTicketSchema>;

export const mySupportListSchema = z.object({
  tickets: z.array(mySupportTicketSchema),
});
export type MySupportList = z.infer<typeof mySupportListSchema>;
