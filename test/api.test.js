const assert = require('node:assert/strict');
const Module = require('node:module');
const { after, before, test } = require('node:test');

const dbPath = require.resolve('../src/config/db');
const databaseStub = new Module(dbPath);
databaseStub.filename = dbPath;
databaseStub.loaded = true;
databaseStub.exports = {};
require.cache[dbPath] = databaseStub;

process.env.AUTH_SECRET = 'test-secret-for-rsvp-api-testing-only-123456';

const app = require('../index');
const prisma = require('../src/config/db');
const EventService = require('../src/services/event.service');
const AttendeeService = require('../src/services/attendee.service');
const RSVPService = require('../src/services/rsvp.service');
const OrganizerService = require('../src/services/organizer.service');
const { createAccessToken, verifyAccessToken } = require('../src/utils/accessTokens');
const { hashPassword, verifyPassword } = require('../src/utils/passwords');

const organizerToken = createAccessToken('organizer-1', 'organizer');
const attendeeToken = createAccessToken('attendee-1', 'attendee');
const rsvpAttendeeId = '00000000-0000-4000-8000-000000000002';
const rsvpAttendeeToken = createAccessToken(rsvpAttendeeId, 'attendee');

const event = {
  id: 'event-1',
  title: 'Community Meetup',
  description: 'Monthly gathering',
  venueOrLink: 'Community Hall',
  dateTime: '2026-11-01T10:00:00.000Z',
  maxCapacity: 20,
  currentCapacity: 0,
};

const attendee = {
  id: 'attendee-1',
  name: 'Alex Example',
  email: 'alex@example.com',
  phoneNumber: '555-0100',
};

const eventInput = {
  title: event.title,
  description: event.description,
  venueOrLink: event.venueOrLink,
  dateTime: event.dateTime,
  maxCapacity: event.maxCapacity,
};

const attendeeInput = {
  name: attendee.name,
  email: attendee.email,
  phoneNumber: attendee.phoneNumber,
};

const rsvpInput = {
  eventId: '00000000-0000-4000-8000-000000000001',
};

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  return { response, json: await response.json() };
}

async function withStubs(stubs, run) {
  const originals = stubs.map(([target, methods]) => [
    target,
    Object.fromEntries(Object.keys(methods).map((method) => [method, target[method]])),
  ]);

  for (const [target, methods] of stubs) {
    Object.assign(target, methods);
  }

  try {
    await run();
  } finally {
    for (const [target, methods] of originals) {
      Object.assign(target, methods);
    }
  }
}

test('GET /api/health reports that the API is running', async () => {
  const { response, json } = await request('/api/health');

  assert.equal(response.status, 200);
  assert.deepEqual(json, { success: true, message: 'RSVP API is running.' });
});

test('POST /api/events creates a validated event', async () => {
  await withStubs([[EventService, { createEvent: async (data) => ({ ...event, ...data }) }]], async () => {
    const { response, json } = await request('/api/events', {
      method: 'POST',
      body: eventInput,
      token: organizerToken,
    });

    assert.equal(response.status, 201);
    assert.deepEqual(json, {
      success: true,
      data: { ...event, ...eventInput, organizerId: 'organizer-1' },
    });
  });
});

test('POST /api/events rejects invalid input', async () => {
  const { response, json } = await request('/api/events', {
    method: 'POST',
    body: { title: '' },
    token: organizerToken,
  });

  assert.equal(response.status, 400);
  assert.equal(json.success, false);
  assert.equal(json.error, 'Validation failed');
  assert.ok(Array.isArray(json.details));
});

test('GET /api/events lists events', async () => {
  await withStubs([[EventService, { getAllEvents: async () => [event] }]], async () => {
    const { response, json } = await request('/api/events');

    assert.equal(response.status, 200);
    assert.deepEqual(json, { success: true, data: [event] });
  });
});

test('GET /api/events/:id returns an event', async () => {
  await withStubs([[EventService, { getEventById: async () => event }]], async () => {
    const { response, json } = await request('/api/events/event-1');

    assert.equal(response.status, 200);
    assert.deepEqual(json, { success: true, data: event });
  });
});

test('GET /api/events/:id returns 404 when the event is missing', async () => {
  await withStubs([[EventService, { getEventById: async () => null }]], async () => {
    const { response, json } = await request('/api/events/missing');

    assert.equal(response.status, 404);
    assert.deepEqual(json, { success: false, error: 'Event not found' });
  });
});

test('PUT /api/events/:id updates a validated event', async () => {
  await withStubs([[EventService, { updateEvent: async (id, data) => ({ ...event, id, ...data }) }]], async () => {
    const { response, json } = await request('/api/events/event-1', {
      method: 'PUT',
      body: { title: 'Updated Meetup' },
      token: organizerToken,
    });

    assert.equal(response.status, 200);
    assert.equal(json.data.title, 'Updated Meetup');
  });
});

test('DELETE /api/events/:id deletes an event', async () => {
  await withStubs([[EventService, { deleteEvent: async () => event }]], async () => {
    const { response, json } = await request('/api/events/event-1', {
      method: 'DELETE',
      token: organizerToken,
    });

    assert.equal(response.status, 200);
    assert.deepEqual(json, { success: true, message: 'Event deleted successfully' });
  });
});

test('GET /api/events/:id/attendees lists event reservations and attendees', async () => {
  const reservations = [{ eventId: event.id, attendee }];
  await withStubs([[EventService, { getEventAttendees: async () => reservations }]], async () => {
    const { response, json } = await request('/api/events/event-1/attendees', {
      token: organizerToken,
    });

    assert.equal(response.status, 200);
    assert.deepEqual(json, { success: true, data: reservations });
  });
});

test('POST /api/attendees creates a validated attendee', async () => {
  await withStubs([[AttendeeService, { createAttendee: async (data) => ({ ...attendee, ...data }) }]], async () => {
    const { response, json } = await request('/api/attendees', {
      method: 'POST',
      body: attendeeInput,
      token: organizerToken,
    });

    assert.equal(response.status, 201);
    assert.deepEqual(json, { success: true, data: { ...attendee, ...attendeeInput } });
  });
});

test('GET /api/attendees lists attendees', async () => {
  await withStubs([[AttendeeService, { getAllAttendees: async () => [attendee] }]], async () => {
    const { response, json } = await request('/api/attendees', { token: organizerToken });

    assert.equal(response.status, 200);
    assert.deepEqual(json, { success: true, data: [attendee] });
  });
});

test('GET /api/attendees/:id returns an attendee', async () => {
  await withStubs([[AttendeeService, { getAttendeeById: async () => attendee }]], async () => {
    const { response, json } = await request('/api/attendees/attendee-1', {
      token: attendeeToken,
    });

    assert.equal(response.status, 200);
    assert.deepEqual(json, { success: true, data: attendee });
  });
});

test('GET /api/attendees/:id returns 404 when the attendee is missing', async () => {
  await withStubs([[AttendeeService, { getAttendeeById: async () => null }]], async () => {
    const { response, json } = await request('/api/attendees/missing', {
      token: attendeeToken,
    });

    assert.equal(response.status, 404);
    assert.deepEqual(json, { success: false, error: 'Attendee not found' });
  });
});

test('PUT /api/attendees/:id updates a validated attendee', async () => {
  await withStubs([[AttendeeService, { updateAttendee: async (id, data) => ({ ...attendee, id, ...data }) }]], async () => {
    const { response, json } = await request('/api/attendees/attendee-1', {
      method: 'PUT',
      body: { name: 'Alex Updated' },
      token: attendeeToken,
    });

    assert.equal(response.status, 200);
    assert.equal(json.data.name, 'Alex Updated');
  });
});

test('DELETE /api/attendees/:id deletes an attendee', async () => {
  await withStubs([[AttendeeService, { deleteAttendee: async () => attendee }]], async () => {
    const { response, json } = await request('/api/attendees/attendee-1', {
      method: 'DELETE',
      token: attendeeToken,
    });

    assert.equal(response.status, 200);
    assert.deepEqual(json, { success: true, message: 'Attendee deleted successfully' });
  });
});

test('GET /api/attendees/:id/events lists attendee reservations and events', async () => {
  const reservations = [{ attendeeId: attendee.id, event }];
  await withStubs([[AttendeeService, { getAttendeeEvents: async () => reservations }]], async () => {
    const { response, json } = await request('/api/attendees/attendee-1/events', {
      token: attendeeToken,
    });

    assert.equal(response.status, 200);
    assert.deepEqual(json, { success: true, data: reservations });
  });
});

test('POST /api/rsvps creates a reservation', async () => {
  const reservation = { ...rsvpInput, attendeeId: rsvpAttendeeId, id: 'reservation-1' };
  await withStubs([[RSVPService, { reserveSpot: async () => reservation }]], async () => {
    const { response, json } = await request('/api/rsvps', {
      method: 'POST',
      body: rsvpInput,
      token: rsvpAttendeeToken,
    });

    assert.equal(response.status, 201);
    assert.deepEqual(json, { success: true, data: reservation });
  });
});

test('POST /api/rsvps rejects invalid identifiers', async () => {
  const { response, json } = await request('/api/rsvps', {
    method: 'POST',
    body: { eventId: 'not-a-uuid' },
    token: rsvpAttendeeToken,
  });

  assert.equal(response.status, 400);
  assert.equal(json.success, false);
  assert.ok(Array.isArray(json.details));
});

test('POST /api/rsvps returns service errors using their status codes', async () => {
  await withStubs([[
    RSVPService,
    {
      reserveSpot: async () => {
        const error = new Error('Event capacity reached');
        error.statusCode = 409;
        throw error;
      },
    },
  ]], async () => {
    const { response, json } = await request('/api/rsvps', {
      method: 'POST',
      body: rsvpInput,
      token: rsvpAttendeeToken,
    });

    assert.equal(response.status, 409);
    assert.deepEqual(json, { success: false, error: 'Event capacity reached' });
  });
});

test('RSVP locks the event before checking and incrementing capacity', async () => {
  const queries = [];
  let reservationCreated = false;
  let capacityIncremented = false;
  const tx = {
    $queryRaw: async (strings) => {
      const query = strings.join(' ');
      queries.push(query);
      if (query.includes('"Attendee"')) return [{ id: rsvpAttendeeId }];
      return [{ id: rsvpInput.eventId, currentCapacity: 1, maxCapacity: 2 }];
    },
    reservation: {
      create: async ({ data }) => {
        reservationCreated = true;
        return data;
      },
    },
    event: {
      update: async () => {
        capacityIncremented = true;
      },
    },
  };

  await withStubs([[prisma, { $transaction: (run) => run(tx) }]], async () => {
    const reservation = await RSVPService.reserveSpot(rsvpInput.eventId, rsvpAttendeeId);
    assert.deepEqual(reservation, {
      ...rsvpInput,
      attendeeId: rsvpAttendeeId,
      status: 'CONFIRMED',
    });
  });

  assert.match(queries[0], /FOR KEY SHARE/);
  assert.match(queries[1], /FOR UPDATE/);
  assert.equal(reservationCreated, true);
  assert.equal(capacityIncremented, true);
});

test('RSVP places an attendee on the waitlist when the event is full', async () => {
  let createdReservation;
  let capacityIncremented = false;
  const tx = {
    $queryRaw: async (strings) => strings.join(' ').includes('"Attendee"')
      ? [{ id: rsvpAttendeeId }]
      : [{ id: rsvpInput.eventId, currentCapacity: 2, maxCapacity: 2 }],
    reservation: {
      create: async ({ data }) => {
        createdReservation = data;
        return data;
      },
    },
    event: { update: async () => { capacityIncremented = true; } },
  };

  await withStubs([[prisma, { $transaction: (run) => run(tx) }]], async () => {
    const reservation = await RSVPService.reserveSpot(rsvpInput.eventId, rsvpAttendeeId);
    assert.equal(reservation.status, 'WAITLISTED');
  });
  assert.equal(createdReservation.status, 'WAITLISTED');
  assert.equal(capacityIncremented, false);
});

test('event capacity cannot be reduced below current registrations', async () => {
  let eventUpdated = false;
  const tx = {
    $queryRaw: async () => [{
      currentCapacity: 5,
      maxCapacity: 10,
      organizerId: 'organizer-1',
    }],
    event: {
      update: async () => {
        eventUpdated = true;
      },
    },
  };

  await withStubs([[prisma, { $transaction: (run) => run(tx) }]], async () => {
    await assert.rejects(
      EventService.updateEvent(event.id, { maxCapacity: 4 }, 'organizer-1'),
      { message: 'Max capacity cannot be less than current registrations', statusCode: 409 },
    );
  });
  assert.equal(eventUpdated, false);
});

test('deleting an attendee decrements capacity for each event with a reservation', async () => {
  const queries = [];
  const decrements = [];
  const tx = {
    $queryRaw: async (strings) => {
      queries.push(strings.join(' '));
      return [{ id: attendee.id }];
    },
    reservation: {
      findMany: async ({ where }) => where.status === 'CONFIRMED'
        ? [{ eventId: 'event-b' }, { eventId: 'event-a' }]
        : [],
    },
    attendee: {
      delete: async () => attendee,
    },
    event: {
      update: async ({ where, data }) => decrements.push([where.id, data.currentCapacity.decrement]),
    },
  };

  await withStubs([[prisma, { $transaction: (run) => run(tx) }]], async () => {
    assert.equal(await AttendeeService.deleteAttendee(attendee.id), attendee);
  });

  assert.match(queries[0], /"Attendee".*FOR UPDATE/);
  assert.match(queries[1], /"Event".*FOR UPDATE/);
  assert.match(queries[2], /"Event".*FOR UPDATE/);
  assert.deepEqual(decrements, [['event-a', 1], ['event-b', 1]]);
});

test('cancelling a confirmed RSVP promotes the oldest waitlisted attendee', async () => {
  const confirmed = {
    id: 'reservation-confirmed',
    eventId: rsvpInput.eventId,
    attendeeId: rsvpAttendeeId,
    status: 'CONFIRMED',
  };
  const waiting = {
    id: 'reservation-waiting',
    eventId: rsvpInput.eventId,
    attendeeId: 'waitlisted-attendee',
    status: 'WAITLISTED',
  };
  let findCount = 0;
  let promoted;
  let capacityUpdated = false;
  const tx = {
    $queryRaw: async (strings) => strings.join(' ').includes('"Attendee"')
      ? [{ id: rsvpAttendeeId }]
      : [{ id: rsvpInput.eventId }],
    reservation: {
      findFirst: async ({ where }) => {
        findCount += 1;
        return where.id ? confirmed : waiting;
      },
      delete: async () => confirmed,
      update: async ({ data }) => {
        promoted = data.status;
        return { ...waiting, ...data };
      },
    },
    event: {
      update: async () => { capacityUpdated = true; },
    },
  };

  await withStubs([[prisma, { $transaction: (run) => run(tx) }]], async () => {
    const result = await RSVPService.cancelReservation(confirmed.id, rsvpAttendeeId);
    assert.equal(result.promotedReservation.id, waiting.id);
  });

  assert.equal(findCount, 2);
  assert.equal(promoted, 'CONFIRMED');
  assert.equal(capacityUpdated, false);
});

test('increasing event capacity promotes queued reservations in order', async () => {
  const updatedReservations = [];
  const increments = [];
  const tx = {
    $queryRaw: async () => [{
      currentCapacity: 2,
      maxCapacity: 3,
      organizerId: 'organizer-1',
    }],
    reservation: {
      findMany: async ({ take }) => {
        assert.equal(take, 3);
        return [{ id: 'wait-1' }, { id: 'wait-2' }];
      },
      update: async ({ where }) => updatedReservations.push(where.id),
    },
    event: {
      update: async ({ data }) => {
        if (data.currentCapacity) {
          increments.push(data.currentCapacity.increment);
          return { ...event, currentCapacity: 4, maxCapacity: 5 };
        }
        return { ...event, currentCapacity: 2, maxCapacity: 5 };
      },
    },
  };

  await withStubs([[prisma, { $transaction: (run) => run(tx) }]], async () => {
    const updated = await EventService.updateEvent(
      event.id,
      { maxCapacity: 5 },
      'organizer-1',
    );
    assert.equal(updated.currentCapacity, 4);
  });
  assert.deepEqual(updatedReservations, ['wait-1', 'wait-2']);
  assert.deepEqual(increments, [2]);
});

test('event listing supports upcoming and date-range filters', async () => {
  let receivedFilters;
  await withStubs([[EventService, {
    getAllEvents: async (filters) => {
      receivedFilters = filters;
      return [event];
    },
  }]], async () => {
    const { response, json } = await request(
      '/api/events?upcoming=true&startDate=2026-11-01T00%3A00%3A00.000Z&endDate=2026-12-01T00%3A00%3A00.000Z',
    );
    assert.equal(response.status, 200);
    assert.deepEqual(json, { success: true, data: [event] });
  });

  assert.equal(receivedFilters.upcoming, true);
  assert.equal(receivedFilters.startDate.toISOString(), '2026-11-01T00:00:00.000Z');
  assert.equal(receivedFilters.endDate.toISOString(), '2026-12-01T00:00:00.000Z');
});

test('event writes require organizer role', async () => {
  const unauthenticated = await request('/api/events', { method: 'POST', body: eventInput });
  assert.equal(unauthenticated.response.status, 401);

  const attendeeRequest = await request('/api/events', {
    method: 'POST',
    body: eventInput,
    token: attendeeToken,
  });
  assert.equal(attendeeRequest.response.status, 403);
});

test('organizer registration returns a role-bearing access token', async () => {
  const organizer = { id: 'organizer-1', email: 'organizer@example.com' };
  await withStubs([[OrganizerService, { register: async () => organizer }]], async () => {
    const { response, json } = await request('/api/organizers/register', {
      method: 'POST',
      body: { email: organizer.email, password: 'a-secure-password-123' },
    });
    assert.equal(response.status, 201);
    assert.deepEqual(json.data.organizer, organizer);
    assert.deepEqual(verifyAccessToken(json.data.token), {
      id: organizer.id,
      role: 'organizer',
    });
  });
});

test('attendee registration returns an attendee access token', async () => {
  const registeredAttendee = { id: 'attendee-2', name: 'Sam Example', email: 'sam@example.com' };
  await withStubs([[AttendeeService, { register: async () => registeredAttendee }]], async () => {
    const { response, json } = await request('/api/attendees/register', {
      method: 'POST',
      body: {
        ...registeredAttendee,
        password: 'a-secure-password-456',
      },
    });
    assert.equal(response.status, 201);
    assert.deepEqual(json.data.attendee, registeredAttendee);
    assert.deepEqual(verifyAccessToken(json.data.token), {
      id: registeredAttendee.id,
      role: 'attendee',
    });
  });
});

test('attendee RSVP cancellation returns the promoted waitlist reservation', async () => {
  const reservationId = '00000000-0000-4000-8000-000000000003';
  const cancellation = {
    reservation: { id: reservationId },
    promotedReservation: { id: 'reservation-2', status: 'CONFIRMED' },
  };
  await withStubs([[RSVPService, {
    cancelReservation: async () => cancellation,
  }]], async () => {
    const { response, json } = await request(`/api/rsvps/${reservationId}`, {
      method: 'DELETE',
      token: rsvpAttendeeToken,
    });
    assert.equal(response.status, 200);
    assert.deepEqual(json, {
      success: true,
      data: {
        cancelledReservationId: reservationId,
        promotedReservation: cancellation.promotedReservation,
      },
    });
  });
});

test('password verification accepts only the matching password', async () => {
  const hash = await hashPassword('a-secure-password-789');
  assert.notEqual(hash, 'a-secure-password-789');
  assert.equal(await verifyPassword('a-secure-password-789', hash), true);
  assert.equal(await verifyPassword('incorrect-password', hash), false);
});
