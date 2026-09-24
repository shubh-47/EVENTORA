const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    eventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: true
    },

    status: {
        type: String,
        enum: ['pending', 'confirmed', 'cancelled'],
        default: 'pending'
    },

    paymentStatus: {
        type: String,
        enum: ['paid', 'not_paid', 'refunded'],
        default: 'not_paid'
    },

    amount: {
        type: Number,
        required: true
    },

    // Razorpay Order ID
    razorpayOrderId: {
        type: String,
        default: null
    },

    // Razorpay Payment ID
    razorpayPaymentId: {
        type: String,
        default: null
    }

}, {
    timestamps: true
});

module.exports = mongoose.model('Bookings', bookingSchema);