const Booking = require('../models/Bookings.js');
const Event = require('../models/Event.js');
const OTP = require('../models/OTP.js');
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const {
    sendOTPEmail,
    sendBookingEmail
} = require('../utils/email.js');


// Generate 6 digit OTP
const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};


// ======================================================
// SEND BOOKING OTP
// ======================================================

exports.sendBookingOTP = async (req, res) => {
    try {
        const otp = generateOtp();

        // Delete old OTP
        await OTP.findOneAndDelete({
            email: req.user.email,
            action: 'event_booking'
        });

        // Create new OTP
        const savedOTP = await OTP.create({
            email: req.user.email,
            otp: otp,
            action: 'event_booking'
        });

        console.log('OTP SAVED:', savedOTP);

        await sendOTPEmail(
            req.user.email,
            otp,
            'event_booking'
        );

        res.status(200).json({
            message: 'OTP sent to email'
        });

    } catch (error) {
        console.error('Send Booking OTP Error:', error);

        res.status(500).json({
            error: 'Failed to send OTP'
        });
    }
};


// ======================================================
// CREATE BOOKING AFTER OTP
// ======================================================

exports.bookEvent = async (req, res) => {
    try {
        const { eventId, otp } = req.body;

        if (!eventId || !otp) {
            return res.status(400).json({
                error: 'Event ID and OTP are required'
            });
        }

        // Check OTP
        const otpRecord = await OTP.findOne({
            email: req.user.email,
            otp: otp,
            action: 'event_booking'
        });

        if (!otpRecord) {
            return res.status(400).json({
                error: 'Invalid or expired OTP'
            });
        }

        // Find event
        const event = await Event.findById(eventId);

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

        // Check existing booking
        const existingBooking = await Booking.findOne({
            userId: req.user._id,
            eventId: eventId,
            status: { $ne: 'cancelled' }
        });

        if (existingBooking) {
            return res.status(400).json({
                error: 'You have already booked this event'
            });
        }

        // Check whether event is free
        const isFreeEvent = Number(event.ticketPrice) === 0;

        // Create booking
        const booking = await Booking.create({
            userId: req.user._id,
            eventId: eventId,

            // Free event = confirmed immediately
            // Paid event = pending until payment
            status: isFreeEvent ? 'confirmed' : 'pending',

            paymentStatus: 'not_paid',

            amount: event.ticketPrice
        });


        // ==================================================
        // FREE EVENT
        // ==================================================

        if (isFreeEvent) {

            // Decrease seat immediately
            event.availableSeats -= 1;

            await event.save();

            // Send confirmation email
            await sendBookingEmail(
                req.user.email,
                req.user.name,
                event.title
            );
        }


        // Delete OTP
        await OTP.deleteMany({
            email: req.user.email,
            action: 'event_booking'
        });


        return res.status(201).json({

            message: isFreeEvent
                ? 'Free ticket booked successfully'
                : 'Booking created successfully. Proceed to payment.',

            bookingId: booking._id,

            isFree: isFreeEvent
        });

    } catch (error) {

        console.error('BOOK EVENT ERROR:', error);

        return res.status(500).json({
            error: error.message || 'Failed to create booking'
        });
    }
};


// ======================================================
// CREATE RAZORPAY ORDER FOR BOOKING
// ======================================================

exports.createBookingOrder = async (req, res) => {
    try {

        const { bookingId } = req.body;

        if (!bookingId) {
            return res.status(400).json({
                error: 'Booking ID is required'
            });
        }


        // Find booking
        const booking = await Booking.findById(bookingId);

        if (!booking) {
            return res.status(404).json({
                error: 'Booking not found'
            });
        }


        // Check ownership
        if (
            booking.userId.toString() !==
            req.user._id.toString()
        ) {
            return res.status(403).json({
                error: 'Unauthorized'
            });
        }


        // Cancelled booking cannot be paid
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


        // FREE EVENT
        if (Number(booking.amount) === 0) {
            return res.status(400).json({
                error: 'This is a free event. No payment is required.'
            });
        }


        // Create Razorpay order
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


// ======================================================
// VERIFY PAYMENT
// ======================================================

exports.verifyPayment = async (req, res) => {
    try {

        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            bookingId
        } = req.body;


        // Check required fields
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


        // Check ownership
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
        const crypto = require('crypto');

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

            bookingId:
                booking._id,

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


// ======================================================
// GET MY BOOKINGS
// ======================================================

exports.getMyBookings = async (req, res) => {
    try {

        const bookings = await Booking.find({
            userId: req.user._id
        })
            .populate('eventId')
            .sort({ createdAt: -1 });


        res.status(200).json(bookings);

    } catch (error) {

        console.error(
            'Get My Bookings Error:',
            error
        );

        res.status(500).json({
            error: 'Failed to fetch bookings'
        });
    }
};


// ======================================================
// GET ALL BOOKINGS - ADMIN
// ======================================================

exports.getAllBookings = async (req, res) => {
    try {

        const bookings = await Booking.find()
            .populate('userId')
            .populate('eventId')
            .sort({ createdAt: -1 });


        res.status(200).json(bookings);

    } catch (error) {

        console.error(
            'Get All Bookings Error:',
            error
        );

        res.status(500).json({
            error: 'Failed to fetch bookings'
        });
    }
};


// ======================================================
// RETURN SEAT
// ======================================================

const returnSeat = async (eventId) => {

    const event = await Event.findById(eventId);

    if (event) {

        event.availableSeats += 1;

        if (
            event.availableSeats >
            event.totalSeats
        ) {
            event.availableSeats =
                event.totalSeats;
        }

        await event.save();
    }
};


// ======================================================
// USER CANCEL BOOKING
// ======================================================

exports.cancelBooking = async (req, res) => {
    try {

        const booking = await Booking.findById(
            req.params.id
        );


        if (!booking) {
            return res.status(404).json({
                error: 'Booking not found'
            });
        }


        // Check ownership
        if (
            booking.userId.toString() !==
            req.user._id.toString()
        ) {
            return res.status(403).json({
                error: 'Unauthorized'
            });
        }


        if (booking.status === 'cancelled') {
            return res.status(400).json({
                error: 'Booking is already cancelled'
            });
        }


        const wasConfirmed =
            booking.status === 'confirmed';


        // Refund paid booking
        if (
            booking.paymentStatus === 'paid' &&
            booking.razorpayPaymentId
        ) {

            await razorpay.payments.refund(
                booking.razorpayPaymentId,
                {
                    amount:
                        booking.amount * 100
                }
            );


            booking.paymentStatus =
                'refunded';
        }


        booking.status = 'cancelled';

        await booking.save();


        // Return seat
        if (wasConfirmed) {
            await returnSeat(
                booking.eventId
            );
        }


        res.status(200).json({
            message:
                'Booking cancelled and refund initiated successfully'
        });


    } catch (error) {

        console.error(
            'Cancel Booking Error:',
            error
        );

        res.status(500).json({
            error:
                error.message ||
                'Failed to cancel booking'
        });
    }
};


// ======================================================
// ADMIN CANCEL / REJECT BOOKING
// ======================================================

exports.rejectBooking = async (req, res) => {
    try {

        const booking = await Booking.findById(
            req.params.id
        );


        if (!booking) {
            return res.status(404).json({
                error: 'Booking not found'
            });
        }


        if (booking.status === 'cancelled') {
            return res.status(400).json({
                error: 'Booking is already cancelled'
            });
        }


        const wasConfirmed =
            booking.status === 'confirmed';


        // Refund paid booking
        if (
            booking.paymentStatus === 'paid' &&
            booking.razorpayPaymentId
        ) {

            await razorpay.payments.refund(
                booking.razorpayPaymentId,
                {
                    amount:
                        booking.amount * 100
                }
            );


            booking.paymentStatus =
                'refunded';
        }


        booking.status = 'cancelled';

        await booking.save();


        // Return seat
        if (wasConfirmed) {
            await returnSeat(
                booking.eventId
            );
        }


        res.status(200).json({
            message:
                'Booking cancelled and refund initiated successfully'
        });


    } catch (error) {

        console.error(
            'Reject Booking Error:',
            error
        );

        res.status(500).json({
            error:
                error.message ||
                'Failed to cancel booking'
        });
    }
};