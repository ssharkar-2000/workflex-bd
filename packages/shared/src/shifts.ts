import { z } from 'zod';

export const shiftStatusSchema = z.enum([
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
]);
export type ShiftStatus = z.infer<typeof shiftStatusSchema>;

export const attendanceMethodSchema = z.enum(['MANUAL', 'QR', 'GPS']);
export type AttendanceMethod = z.infer<typeof attendanceMethodSchema>;

/** What a completed shift came to, broken down as the worker is paid. */
export const shiftEarningsSchema = z.object({
  basePay: z.number().int(),
  overtimePay: z.number().int(),
  bonusPay: z.number().int(),
  total: z.number().int(),
});
export type ShiftEarnings = z.infer<typeof shiftEarningsSchema>;

/** The attendance on a shift: when someone arrived and when they left. */
export const shiftAttendanceSchema = z.object({
  checkInAt: z.string(),
  checkOutAt: z.string().nullable(),
  /** Minutes between the two, or up to now while the shift is running. */
  workedMinutes: z.number().int().nonnegative(),
});
export type ShiftAttendance = z.infer<typeof shiftAttendanceSchema>;

export const shiftSchema = z.object({
  id: z.string().uuid(),
  status: shiftStatusSchema,
  startsAt: z.string(),
  endsAt: z.string(),
  location: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  pay: z.number().int(),
  attendanceMethod: attendanceMethodSchema,

  job: z.object({
    id: z.string().uuid(),
    title: z.string(),
    category: z.string(),
  }),
  /** Whoever posted the job — the person a worker turns up for. */
  employer: z.object({
    id: z.string().uuid(),
    name: z.string(),
    company: z.string().nullable(),
  }),
  /** Who is working it, for the recruiter's side of the screen. */
  worker: z.object({
    id: z.string().uuid(),
    name: z.string(),
    publicId: z.string(),
    phone: z.string(),
  }),

  attendance: shiftAttendanceSchema.nullable(),
  earnings: shiftEarningsSchema.nullable(),
});
export type Shift = z.infer<typeof shiftSchema>;

/** Everything the detail screen shows that a list does not need. */
export const shiftDetailSchema = shiftSchema.extend({
  instructions: z.string().nullable(),
  contactName: z.string().nullable(),
  contactPhone: z.string().nullable(),
  dressCode: z.string().nullable(),
  requiredDocuments: z.array(z.string()),
  cancellationPolicy: z.string().nullable(),
  cancelReason: z.string().nullable(),
});
export type ShiftDetail = z.infer<typeof shiftDetailSchema>;

/** The three figures above the list. */
export const shiftCountsSchema = z.object({
  upcoming: z.number().int().nonnegative(),
  today: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  cancelled: z.number().int().nonnegative(),
});
export type ShiftCounts = z.infer<typeof shiftCountsSchema>;

export const shiftListSchema = z.object({
  counts: shiftCountsSchema,
  shifts: z.array(shiftSchema),
});
export type ShiftList = z.infer<typeof shiftListSchema>;

/** Which side of a shift the person asking is on. */
export const shiftSideSchema = z.enum(['WORK', 'POSTED']);
export type ShiftSide = z.infer<typeof shiftSideSchema>;

export const shiftFilterSchema = z.enum(['UPCOMING', 'TODAY', 'COMPLETED', 'CANCELLED', 'ALL']);
export type ShiftFilter = z.infer<typeof shiftFilterSchema>;

export const createShiftSchema = z
  .object({
    jobId: z.string().uuid(),
    /** Somebody already hired onto that job. */
    workerId: z.string().uuid(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    pay: z.coerce.number().int().positive(),
    location: z.string().trim().max(200).optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    instructions: z.string().trim().max(1000).optional(),
    contactName: z.string().trim().max(120).optional(),
    contactPhone: z.string().trim().max(20).optional(),
    dressCode: z.string().trim().max(200).optional(),
    requiredDocuments: z.array(z.string().trim().max(60)).max(10).optional(),
    cancellationPolicy: z.string().trim().max(500).optional(),
    attendanceMethod: attendanceMethodSchema.default('MANUAL'),
  })
  .refine((shift) => new Date(shift.endsAt) > new Date(shift.startsAt), {
    message: 'A shift has to end after it starts',
    path: ['endsAt'],
  });
export type CreateShiftDto = z.output<typeof createShiftSchema>;
export type CreateShiftInput = z.input<typeof createShiftSchema>;

/** Coordinates, where the shift asks for them. */
export const shiftCheckInSchema = z.object({
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});
export type ShiftCheckInDto = z.output<typeof shiftCheckInSchema>;

export const shiftCheckOutSchema = z.object({
  /** Anything worth recording about how it went. */
  note: z.string().trim().max(500).optional().or(z.literal('')),
});
export type ShiftCheckOutDto = z.output<typeof shiftCheckOutSchema>;

export const cancelShiftSchema = z.object({
  reason: z.string().trim().min(3, 'Say why, so the other side knows').max(500),
});
export type CancelShiftDto = z.output<typeof cancelShiftSchema>;
