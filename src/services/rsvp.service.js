const prisma = require('../config/db');

class RSVPService {
  static async reserveSpot(eventId, attendeeId) {
    return prisma.$transaction(async (tx) => {
      const attendees = await tx.$queryRaw`
        SELECT id FROM "Attendee" WHERE id = ${attendeeId} FOR KEY SHARE
      `;

      if (attendees.length === 0) {
        const error = new Error("Attendee not found");
        error.statusCode = 404;
        throw error;
      }

      const events = await tx.$queryRaw`
        SELECT id, "currentCapacity", "maxCapacity"
        FROM "Event"
        WHERE id = ${eventId}
        FOR UPDATE
      `;
      const event = events[0];

      if (!event) {
        const error = new Error("Event not found");
        error.statusCode = 404;
        throw error;
      }

      const reservation = await tx.reservation.create({
        data: {
          eventId,
          attendeeId,
          status: event.currentCapacity >= event.maxCapacity ? 'WAITLISTED' : 'CONFIRMED'
        }
      });

      if (reservation.status === 'CONFIRMED') {
        await tx.event.update({
          where: { id: eventId },
          data: { currentCapacity: { increment: 1 } }
        });
      }

      return reservation;
    });
  }

  static async cancelReservation(reservationId, attendeeId) {
    return prisma.$transaction(async (tx) => {
      const attendees = await tx.$queryRaw`
        SELECT id FROM "Attendee" WHERE id = ${attendeeId} FOR KEY SHARE
      `;
      if (attendees.length === 0) {
        const error = new Error("Attendee not found");
        error.statusCode = 404;
        throw error;
      }

      const reservation = await tx.reservation.findFirst({
        where: { id: reservationId, attendeeId }
      });
      if (!reservation) {
        const error = new Error("RSVP not found");
        error.statusCode = 404;
        throw error;
      }

      const events = await tx.$queryRaw`
        SELECT id FROM "Event" WHERE id = ${reservation.eventId} FOR UPDATE
      `;
      if (events.length === 0) {
        const error = new Error("Event not found");
        error.statusCode = 404;
        throw error;
      }

      await tx.reservation.delete({ where: { id: reservationId } });
      let promotedReservation = null;
      if (reservation.status === 'CONFIRMED') {
        promotedReservation = await tx.reservation.findFirst({
          where: { eventId: reservation.eventId, status: 'WAITLISTED' },
          orderBy: [{ reservedAt: 'asc' }, { id: 'asc' }]
        });

        if (promotedReservation) {
          promotedReservation = await tx.reservation.update({
            where: { id: promotedReservation.id },
            data: { status: 'CONFIRMED' }
          });
        } else {
          await tx.event.update({
            where: { id: reservation.eventId },
            data: { currentCapacity: { decrement: 1 } }
          });
        }
      }

      return { reservation, promotedReservation };
    });
  }
}
module.exports = RSVPService;