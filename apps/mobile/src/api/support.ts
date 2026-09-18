import {
  mySupportListSchema,
  mySupportTicketSchema,
  type CreateSupportTicketDto,
  type MySupportList,
  type MySupportTicket,
} from '@workflex/shared';
import { api } from './client';

export async function fetchMyTickets(): Promise<MySupportList> {
  const { data } = await api.get('/support/tickets');
  return mySupportListSchema.parse(data);
}

export async function createTicket(
  dto: CreateSupportTicketDto,
): Promise<MySupportTicket> {
  const { data } = await api.post('/support/tickets', dto);
  return mySupportTicketSchema.parse(data);
}
