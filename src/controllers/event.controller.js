const EventService = require('../services/event.service');

exports.createEvent = async (req, res) => {
  const event = await EventService.createEvent({
    ...req.body,
    organizerId: req.user.id
  });
  res.status(201).json({ success: true, data: event });
};

exports.getEvents = async (req, res) => {
  const events = await EventService.getAllEvents(req.validatedQuery);
  res.json({ success: true, data: events });
};

exports.getEventById = async (req, res) => {
  const event = await EventService.getEventById(req.params.id);
  if (!event) return res.status(404).json({ success: false, error: "Event not found" });
  res.json({ success: true, data: event });
};

exports.updateEvent = async (req, res) => {
  const event = await EventService.updateEvent(req.params.id, req.body, req.user.id);
  res.json({ success: true, data: event });
};

exports.deleteEvent = async (req, res) => {
  await EventService.deleteEvent(req.params.id, req.user.id);
  res.json({ success: true, message: "Event deleted successfully" });
};

exports.getEventAttendees = async (req, res) => {
  const attendees = await EventService.getEventAttendees(req.params.id, req.user.id);
  res.json({ success: true, data: attendees });
};