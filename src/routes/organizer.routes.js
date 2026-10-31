const express = require('express');
const router = express.Router();
const OrganizerController = require('../controllers/organizer.controller');
const validate = require('../middlewares/validate');
const {
  organizerRegistrationSchema,
  organizerLoginSchema,
} = require('../utils/validators');

router.post('/register', validate(organizerRegistrationSchema), OrganizerController.register);
router.post('/login', validate(organizerLoginSchema), OrganizerController.login);

module.exports = router;
