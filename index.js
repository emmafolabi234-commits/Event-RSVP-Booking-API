require('dotenv').config();
const express = require('express');
const errorHandler = require('./src/middlewares/errorHandler');

const eventRoutes = require('./src/routes/event.routes');
const attendeeRoutes = require('./src/routes/attendee.routes');
const rsvpRoutes = require('./src/routes/rsvp.routes');
const organizerRoutes = require('./src/routes/organizer.routes');

const app = express();

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: "RSVP API is running." });
});

app.use('/api/events', eventRoutes);
app.use('/api/attendees', attendeeRoutes);
app.use('/api/rsvps', rsvpRoutes);
app.use('/api/organizers', organizerRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
  });
}

module.exports = app;