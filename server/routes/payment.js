const express = require('express');

const router = express.Router();

const { protect } = require('../middleware/auth.js');

const {
    createOrder,
    createBookingOrder,
    verifyPayment
} = require('../controllers/PaymentController.js');


router.post('/create-order', protect, createOrder);

router.post('/booking-order', protect, createBookingOrder);

router.post('/verify', protect, verifyPayment);


module.exports = router;