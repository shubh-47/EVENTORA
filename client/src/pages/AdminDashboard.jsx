import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/authContext.jsx';
import api from '../utils/axios';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    const [events, setEvents] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showEventForm, setShowEventForm] = useState(false);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [paymentFilter, setPaymentFilter] = useState('all');

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        date: '',
        location: '',
        category: '',
        totalSeats: '',
        ticketPrice: '',
        imageUrl: ''
    });

    useEffect(() => {
        if (!user || user.role !== 'admin') {
            navigate('/login');
            return;
        }

        fetchData();
    }, [user, navigate]);

    const fetchData = async () => {
        try {
            const [eventsRes, bookingsRes] = await Promise.all([
                api.get('/event'),
                api.get('/booking/all')
            ]);

            setEvents(eventsRes.data);
            setBookings(bookingsRes.data);
        } catch (error) {
            console.error('Error fetching admin data', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateEvent = async (e) => {
        e.preventDefault();

        try {
            await api.post('/event', formData);

            setShowEventForm(false);

            setFormData({
                title: '',
                description: '',
                date: '',
                location: '',
                category: '',
                totalSeats: '',
                ticketPrice: '',
                imageUrl: ''
            });

            fetchData();
        } catch (error) {
            alert(
                error.response?.data?.error ||
                error.response?.data?.message ||
                'Error creating event'
            );
        }
    };

    const handleDeleteEvent = async (id) => {
        if (!window.confirm('Are you sure you want to delete this event?')) {
            return;
        }

        try {
            await api.delete(`/event/${id}`);
            fetchData();
        } catch (error) {
            alert(
                error.response?.data?.error ||
                error.response?.data?.message ||
                'Error deleting event'
            );
        }
    };

    const handleCancelBooking = async (id) => {
        const booking = bookings.find(b => b._id === id);

        if (!booking) return;

        const message =
            booking.paymentStatus === 'paid'
                ? 'This booking is paid. Cancel it and initiate a Razorpay refund?'
                : 'Cancel this booking?';

        if (!window.confirm(message)) {
            return;
        }

        try {
            await api.delete(`/booking/${id}/reject`);

            alert(
                booking.paymentStatus === 'paid'
                    ? 'Booking cancelled and refund initiated.'
                    : 'Booking cancelled successfully.'
            );

            fetchData();
        } catch (error) {
            alert(
                error.response?.data?.error ||
                error.response?.data?.message ||
                'Error cancelling booking'
            );
        }
    };

    if (loading) {
        return (
            <div className="text-center py-20 text-xl font-semibold">
                Loading admin panel...
            </div>
        );
    }

    const totalRevenue = bookings.reduce(
        (sum, b) =>
            b.paymentStatus === 'paid' && b.status === 'confirmed'
                ? sum + Number(b.amount || 0)
                : sum,
        0
    );

    const refundedAmount = bookings.reduce(
        (sum, b) =>
            b.paymentStatus === 'refunded'
                ? sum + Number(b.amount || 0)
                : sum,
        0
    );

    const totalBookings = bookings.length;

    const confirmedBookings = bookings.filter(
        b => b.status === 'confirmed'
    ).length;

    const cancelledBookings = bookings.filter(
        b => b.status === 'cancelled'
    ).length;

    const paidBookings = bookings.filter(
        b => b.paymentStatus === 'paid'
    ).length;

    const refundedBookings = bookings.filter(
        b => b.paymentStatus === 'refunded'
    ).length;

    const netRevenue = totalRevenue - refundedAmount;

    const filteredBookings = bookings.filter(booking => {
        const searchText = search.trim().toLowerCase();

        const matchesSearch =
            !searchText ||
            booking.eventId?.title?.toLowerCase().includes(searchText) ||
            booking.userId?.name?.toLowerCase().includes(searchText) ||
            booking.userId?.email?.toLowerCase().includes(searchText) ||
            booking._id?.toLowerCase().includes(searchText);

        const matchesStatus =
            statusFilter === 'all' ||
            booking.status === statusFilter;

        const matchesPayment =
            paymentFilter === 'all' ||
            booking.paymentStatus === paymentFilter;

        return matchesSearch && matchesStatus && matchesPayment;
    });

    const getEventRevenue = (eventId) => {
        return bookings
            .filter(
                b =>
                    b.eventId?._id === eventId &&
                    b.paymentStatus === 'paid' &&
                    b.status === 'confirmed'
            )
            .reduce(
                (sum, b) => sum + Number(b.amount || 0),
                0
            );
    };

    const getEventBookings = (eventId) => {
        return bookings.filter(
            b =>
                b.eventId?._id === eventId &&
                b.status === 'confirmed'
        ).length;
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">

            {/* Header */}
            <div className="bg-black text-white rounded-2xl p-6 sm:p-8 mb-8 shadow-lg flex flex-col md:flex-row justify-between items-center gap-6 text-center md:text-left">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold mb-2">
                        Admin Dashboard
                    </h1>
                    <p className="text-gray-300">
                        Manage events, bookings, payments and refunds.
                    </p>
                </div>

                <button
                    onClick={() => setShowEventForm(!showEventForm)}
                    className="w-full md:w-auto bg-white text-black font-bold py-3 px-6 rounded-lg hover:bg-gray-100 transition shadow-md"
                >
                    {showEventForm ? 'Cancel Creation' : '+ Create New Event'}
                </button>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-gray-500 text-sm font-bold uppercase">
                        Total Revenue
                    </p>
                    <h3 className="text-3xl font-black text-green-600 mt-2">
                        ₹{totalRevenue}
                    </h3>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-gray-500 text-sm font-bold uppercase">
                        Net Revenue
                    </p>
                    <h3 className="text-3xl font-black text-emerald-600 mt-2">
                        ₹{netRevenue}
                    </h3>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-gray-500 text-sm font-bold uppercase">
                        Total Bookings
                    </p>
                    <h3 className="text-3xl font-black text-blue-600 mt-2">
                        {totalBookings}
                    </h3>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-gray-500 text-sm font-bold uppercase">
                        Confirmed
                    </p>
                    <h3 className="text-3xl font-black text-green-600 mt-2">
                        {confirmedBookings}
                    </h3>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-gray-500 text-sm font-bold uppercase">
                        Cancelled
                    </p>
                    <h3 className="text-3xl font-black text-red-600 mt-2">
                        {cancelledBookings}
                    </h3>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-gray-500 text-sm font-bold uppercase">
                        Refunded
                    </p>
                    <h3 className="text-3xl font-black text-orange-600 mt-2">
                        ₹{refundedAmount}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                        {refundedBookings} booking(s)
                    </p>
                </div>
            </div>

            {/* Event Form */}
            {showEventForm && (
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 mb-8">
                    <h2 className="text-2xl font-bold mb-6 text-gray-800">
                        Create New Event
                    </h2>

                    <form
                        onSubmit={handleCreateEvent}
                        className="grid grid-cols-1 md:grid-cols-2 gap-6"
                    >
                        <input
                            required
                            type="text"
                            placeholder="Event Title"
                            className="border px-4 py-3 rounded-lg focus:ring-2 focus:ring-gray-700 outline-none"
                            value={formData.title}
                            onChange={e =>
                                setFormData({
                                    ...formData,
                                    title: e.target.value
                                })
                            }
                        />

                        <input
                            required
                            type="text"
                            placeholder="Category (e.g., Tech, Music)"
                            className="border px-4 py-3 rounded-lg focus:ring-2 focus:ring-gray-700 outline-none"
                            value={formData.category}
                            onChange={e =>
                                setFormData({
                                    ...formData,
                                    category: e.target.value
                                })
                            }
                        />

                        <input
                            required
                            type="datetime-local"
                            className="border px-4 py-3 rounded-lg focus:ring-2 focus:ring-gray-700 outline-none"
                            value={formData.date}
                            onChange={e =>
                                setFormData({
                                    ...formData,
                                    date: e.target.value
                                })
                            }
                        />

                        <input
                            required
                            type="text"
                            placeholder="Location"
                            className="border px-4 py-3 rounded-lg focus:ring-2 focus:ring-gray-700 outline-none"
                            value={formData.location}
                            onChange={e =>
                                setFormData({
                                    ...formData,
                                    location: e.target.value
                                })
                            }
                        />

                        <input
                            required
                            type="number"
                            min="1"
                            placeholder="Total Seats"
                            className="border px-4 py-3 rounded-lg focus:ring-2 focus:ring-gray-700 outline-none"
                            value={formData.totalSeats}
                            onChange={e =>
                                setFormData({
                                    ...formData,
                                    totalSeats: e.target.value
                                })
                            }
                        />

                        <input
                            required
                            type="number"
                            min="0"
                            placeholder="Ticket Price (0 for free)"
                            className="border px-4 py-3 rounded-lg focus:ring-2 focus:ring-gray-700 outline-none"
                            value={formData.ticketPrice}
                            onChange={e =>
                                setFormData({
                                    ...formData,
                                    ticketPrice: e.target.value
                                })
                            }
                        />

                        <input
                            required
                            type="text"
                            placeholder="Image URL"
                            className="w-full border px-4 py-3 rounded-lg focus:ring-2 focus:ring-gray-700 outline-none md:col-span-2"
                            value={formData.imageUrl}
                            onChange={e =>
                                setFormData({
                                    ...formData,
                                    imageUrl: e.target.value
                                })
                            }
                        />

                        <textarea
                            required
                            placeholder="Event Description"
                            className="border px-4 py-3 rounded-lg md:col-span-2 h-32 focus:ring-2 focus:ring-gray-700 outline-none"
                            value={formData.description}
                            onChange={e =>
                                setFormData({
                                    ...formData,
                                    description: e.target.value
                                })
                            }
                        />

                        <button
                            type="submit"
                            className="md:col-span-2 bg-gray-900 text-white font-bold py-3 rounded-lg hover:bg-black transition"
                        >
                            Publish Event
                        </button>
                    </form>
                </div>
            )}

            {/* Events */}
            <div className="mb-10">
                <h2 className="text-2xl font-bold mb-6 text-gray-800">
                    All Events ({events.length})
                </h2>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    {events.length === 0 ? (
                        <div className="p-6 text-gray-500 text-center">
                            No events created yet.
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {events.map(event => (
                                <div
                                    key={event._id}
                                    className="p-5 flex flex-col lg:flex-row justify-between gap-5 hover:bg-gray-50"
                                >
                                    <div className="flex-1">
                                        <h4 className="font-bold text-gray-900 text-lg">
                                            {event.title}
                                        </h4>

                                        <div className="flex flex-wrap gap-3 text-sm text-gray-500 mt-2">
                                            <span>
                                                📅 {new Date(event.date).toLocaleString()}
                                            </span>

                                            <span>
                                                📍 {event.location}
                                            </span>

                                            <span>
                                                🎟️ {event.availableSeats}/{event.totalSeats} seats
                                            </span>
                                        </div>

                                        <div className="flex flex-wrap gap-4 mt-3 text-sm">
                                            <span className="font-semibold">
                                                Ticket: ₹{event.ticketPrice}
                                            </span>

                                            <span className="font-semibold text-green-600">
                                                Booked: {getEventBookings(event._id)}
                                            </span>

                                            <span className="font-semibold text-blue-600">
                                                Revenue: ₹{getEventRevenue(event._id)}
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleDeleteEvent(event._id)}
                                        className="w-full lg:w-auto h-fit text-red-500 hover:text-white hover:bg-red-500 border border-red-200 px-4 py-2 rounded-lg text-sm font-bold transition"
                                    >
                                        Delete
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Booking Management */}
            <div>
                <div className="flex flex-col lg:flex-row justify-between gap-4 mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">
                        Booking Management ({filteredBookings.length})
                    </h2>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <input
                            type="text"
                            placeholder="Search user, email, event..."
                            className="border px-4 py-2.5 rounded-lg outline-none focus:ring-2 focus:ring-gray-700"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />

                        <select
                            className="border px-4 py-2.5 rounded-lg outline-none"
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                        >
                            <option value="all">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>

                        <select
                            className="border px-4 py-2.5 rounded-lg outline-none"
                            value={paymentFilter}
                            onChange={e => setPaymentFilter(e.target.value)}
                        >
                            <option value="all">All Payments</option>
                            <option value="paid">Paid</option>
                            <option value="not_paid">Not Paid</option>
                            <option value="refunded">Refunded</option>
                        </select>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    {filteredBookings.length === 0 ? (
                        <div className="p-8 text-gray-500 text-center">
                            No bookings found.
                        </div>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {filteredBookings.map(booking => (
                                <li
                                    key={booking._id}
                                    className={`p-6 border-l-4 ${
                                        booking.status === 'confirmed'
                                            ? 'border-l-green-400'
                                            : booking.status === 'cancelled'
                                                ? 'border-l-red-400'
                                                : 'border-l-yellow-400'
                                    }`}
                                >
                                    <div className="flex flex-col lg:flex-row justify-between gap-5">

                                        <div className="flex-1">
                                            <div className="flex flex-col sm:flex-row justify-between gap-3">
                                                <div>
                                                    <h4 className="font-bold text-gray-900 text-lg">
                                                        {booking.eventId?.title || 'Deleted Event'}
                                                    </h4>

                                                    <p className="text-sm text-gray-500 mt-1">
                                                        Booking ID: {booking._id}
                                                    </p>
                                                </div>

                                                <div className="flex gap-2 flex-wrap h-fit">
                                                    <span
                                                        className={`px-3 py-1 text-xs font-black rounded uppercase ${
                                                            booking.status === 'confirmed'
                                                                ? 'bg-green-100 text-green-700'
                                                                : booking.status === 'cancelled'
                                                                    ? 'bg-red-100 text-red-700'
                                                                    : 'bg-yellow-100 text-yellow-700'
                                                        }`}
                                                    >
                                                        {booking.status}
                                                    </span>

                                                    <span
                                                        className={`px-3 py-1 text-xs font-black rounded uppercase ${
                                                            booking.paymentStatus === 'paid'
                                                                ? 'bg-indigo-100 text-indigo-700'
                                                                : booking.paymentStatus === 'refunded'
                                                                    ? 'bg-orange-100 text-orange-700'
                                                                    : 'bg-gray-200 text-gray-700'
                                                        }`}
                                                    >
                                                        {booking.paymentStatus?.replace('_', ' ') || 'unknown'}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="bg-gray-50 rounded-lg p-4 mt-4 border border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">

                                                <p>
                                                    <strong>User:</strong>{' '}
                                                    {booking.userId?.name || 'Unknown'}
                                                </p>

                                                <p>
                                                    <strong>Email:</strong>{' '}
                                                    {booking.userId?.email || 'Unknown'}
                                                </p>

                                                <p>
                                                    <strong>Event Date:</strong>{' '}
                                                    {booking.eventId?.date
                                                        ? new Date(booking.eventId.date).toLocaleString()
                                                        : 'N/A'}
                                                </p>

                                                <p>
                                                    <strong>Booking Date:</strong>{' '}
                                                    {booking.createdAt
                                                        ? new Date(booking.createdAt).toLocaleString()
                                                        : 'N/A'}
                                                </p>

                                                <p>
                                                    <strong>Amount:</strong>{' '}
                                                    {Number(booking.amount || 0) === 0
                                                        ? 'Free'
                                                        : `₹${booking.amount}`}
                                                </p>

                                                <p>
                                                    <strong>Payment ID:</strong>{' '}
                                                    {booking.razorpayPaymentId || 'Not available'}
                                                </p>

                                                <p>
                                                    <strong>Order ID:</strong>{' '}
                                                    {booking.razorpayOrderId || 'Not available'}
                                                </p>

                                                <p>
                                                    <strong>Seats Remaining:</strong>{' '}
                                                    {booking.eventId
                                                        ? `${booking.eventId.availableSeats}/${booking.eventId.totalSeats}`
                                                        : 'N/A'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="lg:w-48 flex flex-col justify-center gap-2">
                                            {booking.status !== 'cancelled' && (
                                                <button
                                                    onClick={() => handleCancelBooking(booking._id)}
                                                    className="w-full bg-red-50 text-red-600 hover:bg-red-500 hover:text-white border border-red-200 text-sm font-bold py-2.5 px-3 rounded-lg transition"
                                                >
                                                    {booking.paymentStatus === 'paid'
                                                        ? 'Refund & Cancel'
                                                        : 'Cancel Booking'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
