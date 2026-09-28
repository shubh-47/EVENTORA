const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

const transporter = nodemailer.createTransport({
    service: 'gmail',

    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },

    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000
});

// Check SMTP connection when server starts
transporter.verify((error, success) => {
    if (error) {
        console.error('Email server connection failed:', error.message);
    } else {
        console.log('Email server is ready');
    }
});


// ==============================
// BOOKING CONFIRMATION EMAIL
// ==============================
const sendBookingEmail = async (userEmail, userName, eventTitle) => {

    try {

        const mailOptions = {
            from: `"Eventora" <${process.env.EMAIL_USER}>`,
            to: userEmail,

            subject: `Booking Confirmed: ${eventTitle}`,

            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">

                    <h2 style="color: #111;">
                        Booking Confirmed 🎉
                    </h2>

                    <p>
                        Hi <strong>${userName}</strong>,
                    </p>

                    <p>
                        Your booking for
                        <strong>${eventTitle}</strong>
                        has been successfully confirmed.
                    </p>

                    <p>
                        Thank you for choosing <strong>Eventora</strong>.
                    </p>

                    <hr>

                    <p style="color: #777;">
                        This is an automated email. Please do not reply.
                    </p>

                </div>
            `
        };

        await transporter.sendMail(mailOptions);

        console.log('Booking email sent successfully to:', userEmail);

    } catch (error) {

        console.error(
            'Booking email failed:',
            error.message
        );

    }
};


// ==============================
// OTP EMAIL
// ==============================
const sendOTPEmail = async (userEmail, otp, type) => {

    try {

        const title =
            type === 'account_verification'
                ? 'Verify your Eventora Account'
                : 'Eventora Booking Verification';

        const msg =
            type === 'account_verification'
                ? 'Please use the following OTP to verify your new Eventora account.'
                : 'Please use the following OTP to verify and confirm your event booking.';

        const mailOptions = {

            from: `"Eventora" <${process.env.EMAIL_USER}>`,

            to: userEmail,

            subject: title,

            html: `
                <div style="
                    font-family: Arial, sans-serif;
                    text-align: center;
                    padding: 30px;
                ">

                    <h2 style="color: #111;">
                        ${title}
                    </h2>

                    <p style="
                        color: #555;
                        font-size: 16px;
                    ">
                        ${msg}
                    </p>

                    <div style="
                        margin: 25px auto;
                        padding: 15px 25px;
                        font-size: 28px;
                        font-weight: bold;
                        background: #f4f4f4;
                        width: max-content;
                        letter-spacing: 6px;
                        border-radius: 8px;
                    ">
                        ${otp}
                    </div>

                    <p style="
                        color: #999;
                        font-size: 13px;
                    ">
                        This code expires in 5 minutes.
                    </p>

                    <p style="
                        color: #999;
                        font-size: 13px;
                    ">
                        If you didn't request this, please ignore this email.
                    </p>

                </div>
            `
        };

        await transporter.sendMail(mailOptions);

        console.log(
            `OTP sent successfully to ${userEmail} for ${type}`
        );

    } catch (error) {

        console.error(
            'OTP email failed:',
            error.message
        );

    }
};


module.exports = {
    sendBookingEmail,
    sendOTPEmail
};