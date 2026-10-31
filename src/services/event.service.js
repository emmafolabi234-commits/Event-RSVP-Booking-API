const prisma = require('../config/db');

class EventService {
  static createEvent(data) {
    return prisma.event.create({ data });
  }
  
  static getAllEvents(filters = {}) {
    const dateTime = {};
    if (filters.startDate) dateTime.gte = filters.startDate;
    if (filters.endDate) dateTime.lte = filters.endDate;
    if (filters.upcoming === true) {
      dateTime.gte = filters.startDate && filters.startDate > new Date()
        ? filters.startDate
        : new Date();
    } else if (filters.upcoming === false) {
      dateTime.lt = new Date();
    }

    return prisma.event.findMany({
      where: Object.keys(dateTime).length === 0 ? undefined : { dateTime },
      orderBy: { dateTime: 'asc' }
    });
  }

  static getEventById(id) {
    return prisma.event.findUnique({ where: { id } });
  }

  static updateEvent(id, data, organizerId) {
    return prisma.$transaction(async (tx) => {
      const events = await tx.$queryRaw`
        SELECT "currentCapacity", "maxCapacity", "organizerId"
        FROM "Event"
        WHERE id = ${id}
        FOR UPDATE
      `;

      if (events.length === 0 || events[0].organizerId !== organizerId) {
        const error = new Error("Event not found");
        error.statusCode = 404;
        throw error;
      }

      if (data.maxCapacity !== undefined && data.maxCapacity < events[0].currentCapacity) {
        const error = new Error("Max capacity cannot be less than current registrations");
        error.statusCode = 409;
        throw error;
      }

      const updatedEvent = await tx.event.update({
        where: { id },
        data
      });

      if (data.maxCapacity !== undefined && data.maxCapacity > events[0].maxCapacity) {
        const availableSpots = data.maxCapacity - events[0].currentCapacity;
        const waitlisted = await tx.reservation.findMany({
          where: { eventId: id, status: 'WAITLISTED' },
          orderBy: [{ reservedAt: 'asc' }, { id: 'asc' }],
          take: availableSpots,
          select: { id: true }
        });
        for (const reservation of waitlisted) {
          await tx.reservation.update({
            where: { id: reservation.id },
            data: { status: 'CONFIRMED' }
          });
        }
        if (waitlisted.length > 0) {
          return tx.event.update({
            where: { id },
            data: { currentCapacity: { increment: waitlisted.length } }
          });
        }
      }

      return updatedEvent;
    });
  }

  static deleteEvent(id, organizerId) {
    return prisma.$transaction(async (tx) => {
      const events = await tx.$queryRaw`
        SELECT "organizerId" FROM "Event" WHERE id = ${id} FOR UPDATE
      `;
      if (events.length === 0 || events[0].organizerId !== organizerId) {
        const error = new Error("Event not found");
        error.statusCode = 404;
        throw error;
      }
      return tx.event.delete({ where: { id } });
    });
  }

  static async getEventAttendees(eventId, organizerId) {
    const event = await prisma.event.findFirst({
      where: { id: eventId, organizerId },
      select: { id: true }
    });
    if (!event) {
      const error = new Error("Event not found");
      error.statusCode = 404;
      throw error;
    }
    return prisma.reservation.findMany({
      where: { eventId },
      include: {
        attendee: {
          select: { id: true, name: true, email: true, phoneNumber: true }
        }
      },
      orderBy: [{ status: 'asc' }, { reservedAt: 'asc' }]
    });
  }
}
module.exports = EventService;