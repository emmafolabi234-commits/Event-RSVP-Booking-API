const express = require('express');
const router = express.Router();
const EventController = require('../controllers/event.controller');
const authenticateRole = require('../middlewares/authenticateRole');
const validate = require('../middlewares/validate');
const {
  createEventSchema,
  updateEventSchema,
  eventFiltersSchema
} = require('../utils/validators');

router.post('/', authenticateRole('organizer'), validate(createEventSchema), EventController.createEvent);
router.get('/', validate(eventFiltersSchema, 'query'), EventController.getEvents);
router.get('/:id', EventController.getEventById);
router.put('/:id', authenticateRole('organizer'), validate(updateEventSchema), EventController.updateEvent);
router.delete('/:id', authenticateRole('organizer'), EventController.deleteEvent);

router.get('/:id/attendees', authenticateRole('organizer'), EventController.getEventAttendees);

module.exports = router;