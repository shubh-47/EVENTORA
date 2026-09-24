import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/axios';
import { AuthContext } from '../context/authContext.jsx';

import {
    FaCalendarAlt,
    FaMapMarkerAlt,
    FaChair,
    FaMoneyBillWave,
    FaArrowLeft
} from 'react-icons/fa';
const loadRazorpay = () => {
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';

        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);

        document.body.appendChild(script);
    });
};
const EventDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);

    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);

    const [bookingLoading, setBookingLoading] = useState(false);

    const [otp, setOtp] = useState('');
    const [showOTP, setShowOTP] = useState(false);

    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // =====================================================
    // FETCH EVENT
    // =====================================================
    useEffect(() => {
        const fetchEvent = async () => {
            try {
                setLoading(true);
                setError('');

                console.log('Fetching event:', id);

                const { data } = await api.get(`/event/${id}`);

                console.log('Event received:', data);

                setEvent(data);

            } catch (err) {

                console.error(
                    'Error fetching event:',
                    err.response?.data || err.message
                );

                setError(
                    err.response?.data?.error ||
                    err.response?.data?.message ||
                    'Failed to load event details.'
                );

            } finally {
                setLoading(false);
            }
        };

        fetchEvent();

    }, [id]);




const handlePayment = async (bookingId) => {
    try {
        const loaded = await loadRazorpay();

        if (!loaded) {
            setError('Razorpay failed to load');
            return;
        }

        const { data: order } = await api.post('/payment/booking-order', {
            bookingId
        });

        const options = {
            key: import.meta.env.VITE_RAZORPAY_KEY_ID,
            amount: order.amount,
            currency: order.currency,
            name: 'Eventora',
            description: event.title,
            order_id: order.id,

            handler: async function (response) {
                try {
                    await api.post('/payment/verify', {
                        razorpay_order_id: response.razorpay_order_id,
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_signature: response.razorpay_signature,
                        bookingId: bookingId
                    });

                    setSuccessMsg(
                        'Payment successful! Booking confirmed.'
                    );

                } catch (err) {
                    setError(
                        err.response?.data?.error ||
                        'Payment verification failed'
                    );
                }
            },

            theme: {
                color: '#111827'
            }
        };

        const razorpay = new window.Razorpay(options);

        razorpay.open();

    } catch (err) {
        console.error('Payment error:', err);

        setError(
            err.response?.data?.error ||
            'Unable to start payment'
        );
    }
};
    // =====================================================
    // BOOKING
    // STEP 1 = SEND OTP
    // STEP 2 = VERIFY OTP + CREATE PENDING BOOKING
    // =====================================================
    const handleBooking = async () => {

        // User not logged in
        if (!user) {
            navigate('/login');
            return;
        }

        setBookingLoading(true);
        setError('');
        setSuccessMsg('');

        try {

            // =================================================
            // STEP 1: SEND OTP
            // =================================================
            if (!showOTP) {

                await api.post('/booking/send-otp');

                setShowOTP(true);

                setSuccessMsg(
                    'OTP sent to your email. Please enter the 6-digit OTP.'
                );

                return;
            }


            // =================================================
            // STEP 2: VERIFY OTP + CREATE BOOKING
            // =================================================
            if (!otp || otp.length !== 6) {

                setError('Please enter a valid 6-digit OTP.');

                return;
            }

const response = await api.post('/booking', {
    eventId: event._id,
    otp: otp
});

console.log('Booking response:', response.data);

const bookingId = response.data.bookingId;

if (!bookingId) {
    throw new Error('Booking ID not received');
}

await handlePayment(bookingId);

setShowOTP(false);
setOtp('');


            // IMPORTANT:
            // Do NOT decrease availableSeats here.
            //
            // The backend decreases availableSeats only after
            // the admin confirms the booking.
            //
            // Therefore we intentionally do NOT do:
            //
            // setEvent(...)
            //


        } catch (err) {

            console.error(
                'Booking error:',
                err.response?.data || err.message
            );

            setError(
                err.response?.data?.error ||
                err.response?.data?.message ||
                'Booking failed. Please try again.'
            );

        } finally {

            setBookingLoading(false);

        }
    };


    // =====================================================
    // CANCEL OTP / GO BACK
    // =====================================================
    const handleCancelOTP = () => {
        setShowOTP(false);
        setOtp('');
        setError('');
        setSuccessMsg('');
    };


    // =====================================================
    // LOADING
    // =====================================================
    if (loading) {

        return (
            <div className="flex justify-center items-center min-h-screen">

                <div className="text-center">

                    <div className="w-12 h-12 border-4 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-5"></div>

                    <p className="text-xl font-semibold text-gray-700">
                        Loading event...
                    </p>

                </div>

            </div>
        );
    }


    // =====================================================
    // EVENT NOT FOUND
    // =====================================================
    if (!event) {

        return (
            <div className="flex flex-col justify-center items-center min-h-screen px-4">

                <p className="text-xl text-red-500 font-semibold mb-4 text-center">
                    {error || 'Event not found'}
                </p>

                <button
                    onClick={() => navigate('/events')}
                    className="px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-black transition"
                >
                    Back to Events
                </button>

            </div>
        );
    }


    // =====================================================
    // EVENT STATUS
    // =====================================================
    const isSoldOut = event.availableSeats <= 0;

    const seatPercentage =
        event.totalSeats > 0
            ? (event.availableSeats / event.totalSeats) * 100
            : 0;


    // =====================================================
    // MAIN UI
    // =====================================================
    return (
        <div className="max-w-5xl mx-auto px-4 py-8">

            {/* BACK BUTTON */}
            <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-semibold mb-6 transition"
            >
                <FaArrowLeft />
                Back to Events
            </button>


            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">

                {/* =================================================
                    EVENT IMAGE
                ================================================= */}
                {event.imageUrl ? (

                    <img
                        src={event.imageUrl}
                        alt={event.title}
                        className="w-full h-80 md:h-96 object-cover"
                    />

                ) : (

                    <div className="w-full h-80 bg-gray-900 flex items-center justify-center text-white text-5xl font-black uppercase">
                        {event.category || 'EVENT'}
                    </div>

                )}


                <div className="p-6 md:p-10">

                    <div className="flex flex-col lg:flex-row gap-10">

                        {/* =================================================
                            EVENT INFORMATION
                        ================================================= */}
                        <div className="flex-1">

                            {/* CATEGORY */}
                            <div className="inline-block bg-gray-200 text-gray-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide mb-4">
                                {event.category || 'Event'}
                            </div>


                            {/* TITLE */}
                            <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-5">
                                {event.title}
                            </h1>


                            {/* DESCRIPTION */}
                            <p className="text-gray-600 text-lg leading-relaxed mb-8">
                                {event.description}
                            </p>


                            {/* =================================================
                                EVENT INFORMATION
                            ================================================= */}
                            <div className="space-y-5">

                                {/* DATE */}
                                <div className="flex items-center gap-4">

                                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-800">
                                        <FaCalendarAlt />
                                    </div>

                                    <div>

                                        <p className="text-sm text-gray-400 font-semibold uppercase">
                                            Date
                                        </p>

                                        <p className="font-bold text-gray-800">
                                            {new Date(event.date).toLocaleDateString(
                                                undefined,
                                                {
                                                    weekday: 'long',
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric'
                                                }
                                            )}
                                        </p>

                                    </div>

                                </div>


                                {/* LOCATION */}
                                <div className="flex items-center gap-4">

                                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-800">
                                        <FaMapMarkerAlt />
                                    </div>

                                    <div>

                                        <p className="text-sm text-gray-400 font-semibold uppercase">
                                            Location
                                        </p>

                                        <p className="font-bold text-gray-800">
                                            {event.location}
                                        </p>

                                    </div>

                                </div>


                                {/* AVAILABLE SEATS */}
                                <div className="flex items-center gap-4">

                                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-800">
                                        <FaChair />
                                    </div>

                                    <div>

                                        <p className="text-sm text-gray-400 font-semibold uppercase">
                                            Availability
                                        </p>

                                        <p className="font-bold text-gray-800">

                                            <span
                                                className={
                                                    event.availableSeats <= 0
                                                        ? 'text-red-500'
                                                        : event.availableSeats < 10
                                                        ? 'text-orange-500'
                                                        : 'text-gray-800'
                                                }
                                            >
                                                {event.availableSeats}
                                            </span>

                                            {' '} / {event.totalSeats}

                                        </p>

                                    </div>

                                </div>

                            </div>


                            {/* =================================================
                                SEAT PROGRESS
                            ================================================= */}
                            <div className="mt-8">

                                <div className="flex justify-between text-sm mb-2">

                                    <span className="font-semibold text-gray-600">
                                        Seat Availability
                                    </span>

                                    <span className="font-semibold text-gray-600">
                                        {Math.round(seatPercentage)}%
                                    </span>

                                </div>

                                <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">

                                    <div
                                        className="h-full bg-gray-800 rounded-full transition-all"
                                        style={{
                                            width: `${Math.min(
                                                Math.max(seatPercentage, 0),
                                                100
                                            )}%`
                                        }}
                                    ></div>

                                </div>

                            </div>

                        </div>


                        {/* =================================================
                            BOOKING CARD
                        ================================================= */}
                        <div className="lg:w-96 bg-gray-50 p-6 rounded-2xl border border-gray-100 shadow-sm">

                            <h2 className="text-2xl font-bold text-gray-800 mb-6">
                                Booking Details
                            </h2>


                            {/* TICKET PRICE */}
                            <div className="flex items-center gap-4 mb-6">

                                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-900">
                                    <FaMoneyBillWave />
                                </div>

                                <div>

                                    <p className="text-sm font-semibold text-gray-400 uppercase">
                                        Ticket Price
                                    </p>

                                    <p className="font-bold text-gray-800 text-xl">

                                        {event.ticketPrice === 0 ? (

                                            <span className="text-green-500">
                                                Free
                                            </span>

                                        ) : (

                                            `₹${event.ticketPrice}`

                                        )}

                                    </p>

                                </div>

                            </div>


                            {/* =================================================
                                OTP INPUT
                            ================================================= */}
                            {showOTP && (

                                <div className="mb-5">

                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Enter OTP
                                    </label>

                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="6-digit OTP"
                                        maxLength={6}
                                        value={otp}
                                        onChange={(e) => {
                                            setOtp(
                                                e.target.value.replace(
                                                    /\D/g,
                                                    ''
                                                )
                                            );
                                            setError('');
                                        }}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-700 shadow-sm font-bold tracking-widest text-center text-lg"
                                    />

                                    <p className="text-xs text-gray-500 text-center mt-2">
                                        Check your registered email for the OTP.
                                    </p>

                                    <button
                                        type="button"
                                        onClick={handleCancelOTP}
                                        className="w-full mt-3 text-sm text-gray-500 hover:text-gray-900 underline"
                                    >
                                        Cancel
                                    </button>

                                </div>

                            )}


                            {/* ERROR */}
                            {error && (

                                <div className="mb-4 text-red-600 text-center font-medium bg-red-50 p-3 rounded-xl">
                                    {error}
                                </div>

                            )}


                            {/* SUCCESS */}
                            {successMsg && (

                                <div className="mb-4 text-green-600 text-center font-medium bg-green-50 p-3 rounded-xl">
                                    {successMsg}
                                </div>

                            )}


                            {/* =================================================
                                BOOKING BUTTON
                            ================================================= */}
                            <button
                                onClick={handleBooking}
                                disabled={
                                    isSoldOut ||
                                    bookingLoading ||
                                    (showOTP && otp.length !== 6)
                                }
                                className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition shadow-lg ${
                                    isSoldOut ||
                                    bookingLoading ||
                                    (showOTP && otp.length !== 6)
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-gray-900 hover:bg-black text-white hover:shadow-xl hover:-translate-y-1'
                                }`}
                            >

                                {bookingLoading
                                    ? 'Processing...'
                                    : showOTP
                                    ? 'Verify OTP & Request Booking'
                                    : isSoldOut
                                    ? 'Sold Out'
                                    : 'Book Event'}

                            </button>


                            {/* =================================================
                                PENDING BOOKING INFORMATION
                            ================================================= */}
                            <div className="mt-6 p-4 bg-white rounded-xl border border-gray-200">

                                <p className="text-xs text-gray-500 leading-relaxed text-center">

                                    After OTP verification, your booking will
                                    be submitted for admin confirmation.
                                    Your seat will be reserved only after
                                    the booking is confirmed.

                                </p>

                            </div>

                        </div>

                    </div>

                </div>

            </div>

        </div>
    );
};

export default EventDetail;