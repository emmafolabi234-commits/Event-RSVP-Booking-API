const OrganizerService = require('../services/organizer.service');
const { createAccessToken } = require('../utils/accessTokens');

exports.register = async (req, res) => {
  const organizer = await OrganizerService.register(req.body);
  const token = createAccessToken(organizer.id, 'organizer');
  res.status(201).json({ success: true, data: { organizer, token } });
};

exports.login = async (req, res) => {
  const organizer = await OrganizerService.login(req.body);
  const token = createAccessToken(organizer.id, 'organizer');
  res.json({ success: true, data: { organizer, token } });
};
