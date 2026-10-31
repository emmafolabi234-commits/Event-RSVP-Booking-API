const prisma = require('../config/db');
const { hashPassword, verifyPassword } = require('../utils/passwords');

const attendeePublicFields = {
  id: true,
  name: true,
  email: true,
  phoneNumber: true
};

class AttendeeService {
  static async register({ name, email, phoneNumber, password }) {
    const passwordHash = await hashPassword(password);
    return prisma.attendee.create({
      data: { name, email, phoneNumber, passwordHash },
      select: { id: true, name: true, email: true, phoneNumber: true }
    });
  }

  static async login({ email, password }) {
    const attendee = await prisma.attendee.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, phoneNumber: true, passwordHash: true }
    });
    if (!attendee || !attendee.passwordHash ||
        !(await verifyPassword(password, attendee.passwordHash))) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    const { passwordHash, ...safeAttendee } = attendee;
    return safeAttendee;
  }

  static createAttendee(data) {
    return prisma.attendee.create({ data, select: attendeePublicFields });
  }

  static getAllAttendees() {
    return prisma.attendee.findMany({ select: attendeePublicFields });
  }

  static getAttendeeById(id) {
    return prisma.attendee.findUnique({ where: { id }, select: attendeePublicFields });
  }

  static updateAttendee(id, data) {
    return prisma.attendee.update({
      where: { id },
      data,
      select: attendeePublicFields
    });
  }

  static deleteAttendee(id) {
    return prisma.$transaction(async (tx) => {
      const attendees = await tx.$queryRaw`
        SELECT id FROM "Attendee" WHERE id = ${id} FOR UPDATE
      `;

      if (attendees.length === 0) {
        const error = new Error("Attendee not found");
        error.statusCode = 404;
        throw error;
      }

      const reservations = await tx.reservation.findMany({
        where: { attendeeId: id, status: 'CONFIRMED' },
        select: { eventId: true }
      });
      const reservationsByEvent = new Map();
      for (const { eventId } of reservations) {
        reservationsByEvent.set(eventId, (reservationsByEvent.get(eventId) || 0) + 1);
      }

      for (const eventId of [...reservationsByEvent.keys()].sort()) {
        await tx.$queryRaw`
          SELECT id FROM "Event" WHERE id = ${eventId} FOR UPDATE
        `;
      }

      const attendee = await tx.attendee.delete({
        where: { id },
        select: attendeePublicFields
      });

      for (const eventId of [...reservationsByEvent.keys()].sort()) {
        const waiting = await tx.reservation.findMany({
          where: { eventId, status: 'WAITLISTED' },
          orderBy: [{ reservedAt: 'asc' }, { id: 'asc' }],
          take: reservationsByEvent.get(eventId),
          select: { id: true }
        });
        for (const reservation of waiting) {
          await tx.reservation.update({
            where: { id: reservation.id },
            data: { status: 'CONFIRMED' }
          });
        }

        const releasedSpots = reservationsByEvent.get(eventId) - waiting.length;
        if (releasedSpots > 0) {
          await tx.event.update({
            where: { id: eventId },
            data: { currentCapacity: { decrement: releasedSpots } }
          });
        }
      }

      return attendee;
    });
  }

  static getAttendeeEvents(attendeeId) {
    return prisma.reservation.findMany({
      where: { attendeeId },
      include: { event: true }
    });
  }
}
module.exports = AttendeeService;