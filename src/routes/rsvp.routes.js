const express = require('express');
const router = express.Router();
const RSVPController = require('../controllers/rsvp.controller');
const authenticateRole = require('../middlewares/authenticateRole');
const validate = require('../middlewares/validate');
const { reservationIdSchema, rsvpSchema } = require('../utils/validators');

router.post('/', authenticateRole('attendee'), validate(rsvpSchema), RSVPController.createRSVP);
router.delete(
  '/:id',
  authenticateRole('attendee'),
  validate(reservationIdSchema, 'params'),
  RSVPController.cancelRSVP
);

module.exports = router;