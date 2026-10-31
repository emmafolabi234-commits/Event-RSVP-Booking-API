const AttendeeService = require('../services/attendee.service');
const { createAccessToken } = require('../utils/accessTokens');

exports.register = async (req, res) => {
  const attendee = await AttendeeService.register(req.body);
  const token = createAccessToken(attendee.id, 'attendee');
  res.status(201).json({ success: true, data: { attendee, token } });
};

exports.login = async (req, res) => {
  const attendee = await AttendeeService.login(req.body);
  const token = createAccessToken(attendee.id, 'attendee');
  res.json({ success: true, data: { attendee, token } });
};

exports.createAttendee = async (req, res) => {
  const attendee = await AttendeeService.createAttendee(req.body);
  res.status(201).json({ success: true, data: attendee });
};

exports.getAttendees = async (req, res) => {
  const attendees = await AttendeeService.getAllAttendees();
  res.json({ success: true, data: attendees });
};

exports.getAttendeeById = async (req, res) => {
  if (req.params.id !== req.user.id) {
    return res.status(404).json({ success: false, error: "Attendee not found" });
  }
  const attendee = await AttendeeService.getAttendeeById(req.params.id);
  if (!attendee) return res.status(404).json({ success: false, error: "Attendee not found" });
  res.json({ success: true, data: attendee });
};

exports.updateAttendee = async (req, res) => {
  if (req.params.id !== req.user.id) {
    return res.status(404).json({ success: false, error: "Attendee not found" });
  }
  const attendee = await AttendeeService.updateAttendee(req.params.id, req.body);
  res.json({ success: true, data: attendee });
};

exports.deleteAttendee = async (req, res) => {
  if (req.params.id !== req.user.id) {
    return res.status(404).json({ success: false, error: "Attendee not found" });
  }
  await AttendeeService.deleteAttendee(req.params.id);
  res.json({ success: true, message: "Attendee deleted successfully" });
};

exports.getAttendeeEvents = async (req, res) => {
  if (req.params.id !== req.user.id) {
    return res.status(404).json({ success: false, error: "Attendee not found" });
  }
  const events = await AttendeeService.getAttendeeEvents(req.user.id);
  res.json({ success: true, data: events });
};