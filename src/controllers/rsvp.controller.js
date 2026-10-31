const RSVPService = require('../services/rsvp.service');

exports.createRSVP = async (req, res) => {
  const { eventId } = req.body;
  const reservation = await RSVPService.reserveSpot(eventId, req.user.id);
  res.status(201).json({ success: true, data: reservation });
};

exports.cancelRSVP = async (req, res) => {
  const result = await RSVPService.cancelReservation(req.params.id, req.user.id);
  res.json({
    success: true,
    data: {
      cancelledReservationId: result.reservation.id,
      promotedReservation: result.promotedReservation
    }
  });
};