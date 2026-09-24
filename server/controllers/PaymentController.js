const Razorpay = require('razorpay');
const crypto = require('crypto');

const Booking = require('../models/Bookings.js');
const Event = require('../models/Event.js');
const { sendBookingEmail } = require('../utils/email.js');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});


// Create normal Razorpay order
exports.createOrder = async (req, res) => {
    try {
        const { amount } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                error: 'Valid amount is required'
            });
        }

        const options = {
            amount: amount * 100,
            currency: 'INR',
            receipt: `receipt_${Date.now()}`
        };

        const order = await razorpay.orders.create(options);

        res.status(200).json(order);

    } catch (error) {
        console.error('Razorpay Order Error:', error);

        res.status(500).json({
            error: 'Failed to create payment order'
        });
    }
};


// Create Razorpay order for booking
exports.createBookingOrder = async (req, res) => {
    try {
        const { bookingId } = req.body;

        if (!bookingId) {
            return res.status(400).json({
                error: 'Booking ID is required'
            });
        }

        const booking = await Booking.findById(bookingId);

        if (!booking) {
            return res.status(404).json({
                error: 'Booking not found'
            });
        }

        // Check booking ownership
        if (
            booking.userId.toString() !==
            req.user._id.toString()
        ) {
            return res.status(403).json({
                error: 'Unauthorized'
            });
        }

        // Cannot pay cancelled booking
        if (booking.status === 'cancelled') {
            return res.status(400).json({
                error: 'Cancelled booking cannot be paid'
            });
        }

        // Already paid
        if (booking.paymentStatus === 'paid') {
            return res.status(400).json({
                error: 'Booking is already paid'
            });
        }

        const options = {
            amount: booking.amount * 100,
            currency: 'INR',
            receipt: `booking_${booking._id}`
        };

        const order = await razorpay.orders.create(options);

        // Save Razorpay order ID
        booking.razorpayOrderId = order.id;

        await booking.save();

        res.status(200).json(order);

    } catch (error) {
        console.error(
            'Razorpay Booking Order Error:',
            error
        );

        res.status(500).json({
            error: 'Failed to create payment order'
        });
    }
};


// Verify Razorpay payment
exports.verifyPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            bookingId
        } = req.body;

        // Check required data
        if (
            !razorpay_order_id ||
            !razorpay_payment_id ||
            !razorpay_signature ||
            !bookingId
        ) {
            return res.status(400).json({
                error: 'Payment details are required'
            });
        }

        // Find booking
        const booking = await Booking.findById(bookingId)
            .populate('eventId')
            .populate('userId');

        if (!booking) {
            return res.status(404).json({
                error: 'Booking not found'
            });
        }

        // Check booking ownership
        if (
            booking.userId._id.toString() !==
            req.user._id.toString()
        ) {
            return res.status(403).json({
                error: 'Unauthorized'
            });
        }

        // Check Razorpay order ID
        if (
            !booking.razorpayOrderId ||
            booking.razorpayOrderId !== razorpay_order_id
        ) {
            return res.status(400).json({
                error: 'Invalid Razorpay order'
            });
        }

        // Generate signature
        const generatedSignature = crypto
            .createHmac(
                'sha256',
                process.env.RAZORPAY_KEY_SECRET
            )
            .update(
                razorpay_order_id +
                '|' +
                razorpay_payment_id
            )
            .digest('hex');

        // Verify signature
        if (
            generatedSignature !== razorpay_signature
        ) {
            return res.status(400).json({
                error: 'Invalid payment signature'
            });
        }

        // Prevent duplicate verification
        if (booking.paymentStatus === 'paid') {
            return res.status(400).json({
                error: 'Payment already verified'
            });
        }

        // Find event
        const event = await Event.findById(
            booking.eventId._id
        );

        if (!event) {
            return res.status(404).json({
                error: 'Event not found'
            });
        }

        // Check seats
        if (event.availableSeats <= 0) {
            return res.status(400).json({
                error: 'No seats available'
            });
        }

        // Payment successful
        booking.paymentStatus = 'paid';

        // Automatically confirm booking
        booking.status = 'confirmed';

        booking.razorpayPaymentId =
            razorpay_payment_id;

        await booking.save();

        // Decrease available seats
        event.availableSeats -= 1;

        await event.save();

        // Send confirmation email
        await sendBookingEmail(
            booking.userId.email,
            booking.userId.name,
            event.title
        );

        res.status(200).json({
            message:
                'Payment verified and booking confirmed',

            bookingId: booking._id,

            availableSeats:
                event.availableSeats
        });

    } catch (error) {
        console.error(
            'Payment Verification Error:',
            error
        );

        res.status(500).json({
            error: 'Payment verification failed'
        });
    }
};