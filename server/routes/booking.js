const express = require('express');

const router = express.Router();

const { protect, admin } = require('../middleware/auth.js');

const {
    bookEvent,
    sendBookingOTP,
    getMyBookings,
    getAllBookings,
    cancelBooking,
    rejectBooking
} = require('../controllers/bookingController.js');


// Create booking after OTP verification
router.post('/', protect, bookEvent);


// Send booking OTP
router.post('/send-otp', protect, sendBookingOTP);


// Get logged-in user's bookings
router.get('/my', protect, getMyBookings);


// User cancels booking
router.delete('/:id', protect, cancelBooking);


// Admin cancels/rejects booking + refund if already paid
router.delete('/:id/reject', protect, admin, rejectBooking);


// Admin gets all bookings
router.get('/all', protect, admin, getAllBookings);


module.exports = router;