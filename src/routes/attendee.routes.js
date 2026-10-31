const express = require('express');
const router = express.Router();
const AttendeeController = require('../controllers/attendee.controller');
const authenticateRole = require('../middlewares/authenticateRole');
const validate = require('../middlewares/validate');
const {
  createAttendeeSchema,
  updateAttendeeSchema,
  attendeeRegistrationSchema,
  organizerLoginSchema
} = require('../utils/validators');

router.post('/register', validate(attendeeRegistrationSchema), AttendeeController.register);
router.post('/login', validate(organizerLoginSchema), AttendeeController.login);
router.post('/', authenticateRole('organizer'), validate(createAttendeeSchema), AttendeeController.createAttendee);
router.get('/', authenticateRole('organizer'), AttendeeController.getAttendees);
router.get('/:id', authenticateRole('attendee'), AttendeeController.getAttendeeById);
router.put('/:id', authenticateRole('attendee'), validate(updateAttendeeSchema), AttendeeController.updateAttendee);
router.delete('/:id', authenticateRole('attendee'), AttendeeController.deleteAttendee);

router.get('/:id/events', authenticateRole('attendee'), AttendeeController.getAttendeeEvents);

module.exports = router;