# Event RSVP API

A Node.js/Express REST API for managing organizers, attendees, events, and event
reservations. PostgreSQL stores the data, and Prisma handles database access.
The API supports capacity limits, ordered waitlists, and role-based access.

## Requirements

- Node.js and npm
- PostgreSQL
- The project dependencies (installed with `npm install`)

## Run locally

1. Create a PostgreSQL database for the application.
2. In the project root, create a `.env` file:

   ```dotenv
   DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/DATABASE_NAME?schema=public"
   AUTH_SECRET="replace-this-with-a-private-random-secret-at-least-32-characters-long"
   PORT=3000
   ```

   Replace the database URL values with your PostgreSQL credentials and
   database name. `AUTH_SECRET` is used to sign access tokens; keep it private
   and use a securely generated value of at least 32 characters. For example,
   generate a value with:

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   Put the generated value in `.env`. Do not commit `.env` or share its
   contents.

3. Install dependencies:

   ```sh
   npm install
   ```

4. Create or update the database tables to match the Prisma schema:

   ```sh
   npx prisma db push
   ```

   `npm install` runs Prisma Client generation through the package's
   `postinstall` script. If needed, generate it explicitly with
   `npx prisma generate`.

5. Start the development server:

   ```sh
   npm run dev
   ```

   The API listens at `http://localhost:3000` by default, or at the port set
   by `PORT`. Stop it with Ctrl+C. Check that it is responding with
   `GET http://localhost:3000/api/health`.

To run the automated test suite:

```sh
npm test
```

The current tests use a stubbed database for API and service behavior. For
database-backed manual testing, configure a development PostgreSQL database as
described above. The full request examples and Postman setup are in
[PostmanDocumentation.txt](./PostmanDocumentation.txt).

## Configuration and database

- `DATABASE_URL` is the PostgreSQL connection string. It is required by Prisma.
- `AUTH_SECRET` must be at least 32 characters and is required to create or
  verify tokens.
- `PORT` is optional and defaults to `3000`.

The Prisma schema defines four models:

- **Organizer**: unique email, password hash, and owned events.
- **Attendee**: unique email, name, optional phone number, optional password
  hash, and reservations.
- **Event**: event details, maximum capacity, current confirmed capacity, and
  an optional organizer owner.
- **Reservation**: attendee/event relationship, reservation time, and status
  (`CONFIRMED` or `WAITLISTED`). An attendee can reserve for a given event only
  once.

`prisma db push` synchronizes the schema directly with the configured database;
this repository does not currently define a migration workflow. Existing
events may have a null `organizerId`; those events can still be browsed, but no
organizer can update or delete them until ownership is assigned.

## How the program works

`index.js` loads environment variables, configures Express JSON parsing,
registers the health endpoint and API routers, then installs centralized error
handling. The database client in `src/config/db.js` uses Prisma's PostgreSQL
adapter. Each router validates request data with Zod before calling its
controller; controllers format HTTP responses, and service classes implement
database operations and business rules.

### Accounts and access tokens

Organizers and attendees register and log in separately. Registration
validates the input, hashes the password with Node.js `scrypt`, stores the hash
instead of the plaintext password, and returns the public account data with
an access token. Login verifies the supplied password against the stored
hash. Account responses do not include password hashes.

Tokens are signed with `AUTH_SECRET`, contain the account ID and role, and
expire after 12 hours. Send them on protected requests as:

```http
Authorization: Bearer <token>
```

Organizer-only routes reject attendee tokens; attendee-only routes reject
organizer tokens. Attendees may access only their own profile, reservations,
and event list. Organizers may manage only events they own.

### Event endpoints

Organizers create events, which are associated with the organizer in their
token. Public endpoints let clients list events and retrieve an event by ID.
Event listing is ordered by date/time and accepts these optional query
parameters:

- `upcoming=true` — events from the current time onward.
- `upcoming=false` — events before the current time.
- `startDate` — inclusive lower date/time bound.
- `endDate` — inclusive upper date/time bound.

When both date bounds are provided, the start must not be later than the end.
An event owner can update or delete their event and can list its reservations
and attendee contact details. Reducing `maxCapacity` below the current number
of confirmed reservations is rejected. Increasing capacity promotes
waitlisted reservations in reservation-time order (with ID as a tie-breaker).

### Reservations, capacity, and waitlists

An authenticated attendee creates a reservation by submitting an event ID.
The service checks that both the attendee and event exist. If confirmed
capacity is below maximum capacity, the reservation is `CONFIRMED` and
`currentCapacity` increases. Otherwise, it is `WAITLISTED` and confirmed
capacity does not change.

Reservation creation and cancellation run in database transactions and lock
the relevant event row while changing capacity or reservation status. This
serializes competing requests so capacity is not allocated beyond the event's
limit.

An attendee can cancel only their own reservation. Cancelling a waitlisted
reservation does not affect confirmed capacity. Cancelling a confirmed
reservation promotes the oldest waitlisted reservation if one exists;
otherwise, confirmed capacity decreases by one. Deleting an attendee also
removes their reservations; confirmed places released by deletion are used to
promote waitlisted attendees where possible.

### Validation and errors

Invalid request bodies, query parameters, and RSVP reservation IDs return
HTTP 400 with validation details. Missing resources return HTTP 404. Missing,
invalid, or expired credentials return HTTP 401; a valid token with the wrong
role returns HTTP 403. Duplicate unique records return HTTP 409. Errors use a
JSON response with `success: false` and an `error` message.

## Endpoint reference

All endpoints are prefixed with `/api`. Bodies are JSON unless noted.

### Health

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Public | Check that the API is running. |

### Organizers

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/organizers/register` | Public | Register with `email` and `password` (12-128 characters). |
| `POST` | `/api/organizers/login` | Public | Log in with `email` and `password`. |

### Attendees

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/attendees/register` | Public | Register with `name`, `email`, `password` (12-128 characters), and optional `phoneNumber`. |
| `POST` | `/api/attendees/login` | Public | Log in with `email` and `password`. |
| `POST` | `/api/attendees` | Organizer | Create an attendee record with `name`, `email`, and optional `phoneNumber`. |
| `GET` | `/api/attendees` | Organizer | List attendee public fields. |
| `GET` | `/api/attendees/:id` | That attendee | Get the authenticated attendee's profile. |
| `PUT` | `/api/attendees/:id` | That attendee | Update profile fields: `name`, `email`, or `phoneNumber`. |
| `DELETE` | `/api/attendees/:id` | That attendee | Delete the account and its reservations. |
| `GET` | `/api/attendees/:id/events` | That attendee | List the authenticated attendee's reservations and events. |

### Events

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/events` | Organizer | Create an event with `title`, `venueOrLink`, ISO `dateTime`, and positive integer `maxCapacity`; optional `description`. |
| `GET` | `/api/events` | Public | List events; optional filters: `upcoming`, `startDate`, and `endDate`. |
| `GET` | `/api/events/:id` | Public | Get an event by ID. |
| `PUT` | `/api/events/:id` | Event owner | Partially update event fields. |
| `DELETE` | `/api/events/:id` | Event owner | Delete an event. |
| `GET` | `/api/events/:id/attendees` | Event owner | List confirmed and waitlisted reservations with attendee details. |

### RSVPs

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/rsvps` | Attendee | Create a reservation using `{ "eventId": "<event-uuid>" }`. |
| `DELETE` | `/api/rsvps/:id` | Reservation owner | Cancel the authenticated attendee's reservation by reservation UUID. |
