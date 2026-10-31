const { z } = require('zod');

const createEventSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  venueOrLink: z.string(),
  dateTime: z.string().datetime(),
  maxCapacity: z.number().int().positive()
});

const updateEventSchema = createEventSchema.partial();

const createAttendeeSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phoneNumber: z.string().optional()
});

const updateAttendeeSchema = createAttendeeSchema.partial();

const rsvpSchema = z.object({
  eventId: z.string().uuid()
});

const organizerRegistrationSchema = z.object({
  email: z.string().email().transform((email) => email.toLowerCase()),
  password: z.string().min(12).max(128)
});

const organizerLoginSchema = z.object({
  email: z.string().email().transform((email) => email.toLowerCase()),
  password: z.string().min(1).max(128)
});

const attendeeRegistrationSchema = createAttendeeSchema.extend({
  email: z.string().email().transform((email) => email.toLowerCase()),
  password: z.string().min(12).max(128)
});

const eventFiltersSchema = z.object({
  upcoming: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  startDate: z.string().refine((value) => !Number.isNaN(Date.parse(value))).transform((value) => new Date(value)).optional(),
  endDate: z.string().refine((value) => !Number.isNaN(Date.parse(value))).transform((value) => new Date(value)).optional()
}).refine(
  ({ startDate, endDate }) => !startDate || !endDate || startDate <= endDate,
  { message: 'startDate must be on or before endDate', path: ['endDate'] }
);

const reservationIdSchema = z.object({
  id: z.string().uuid()
});

module.exports = { 
  createEventSchema, 
  updateEventSchema, 
  createAttendeeSchema, 
  updateAttendeeSchema, 
  rsvpSchema,
  organizerRegistrationSchema,
  organizerLoginSchema,
  attendeeRegistrationSchema,
  eventFiltersSchema,
  reservationIdSchema
};