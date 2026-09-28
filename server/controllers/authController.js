const User = require('../models/User.js');
const { sendOTPEmail } = require('../utils/email.js');
const OTP = require('../models/OTP.js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');


// Generate Token
const generateToken = (id, role) => {
    return jwt.sign(
        { id, role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
};


// Register User
exports.registerUser = async (req, res) => {

    const { name, email, password, role } = req.body;

    try {

        console.log("1. Register request received:", email);

        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json({
                error: 'User already exists'
            });
        }

        const salt = await bcrypt.genSalt(10);

        const hashedPassword = await bcrypt.hash(
            password,
            salt
        );

        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            role,
            isVerified: false
        });

        console.log("2. User created:", user.email);

        const otp = Math.floor(
            100000 + Math.random() * 900000
        ).toString();

        console.log("3. OTP generated:", otp);

        const otpRecord = await OTP.create({
            email,
            otp,
            action: 'account_verification'
        });

        console.log("4. OTP saved:", otpRecord._id);

        await sendOTPEmail(
            email,
            otp,
            'account_verification'
        );

        console.log("5. OTP email function completed");

        return res.status(201).json({
            message: 'User registered successfully. Please check your email for OTP to verify',
            email: user.email
        });

    } catch (error) {

        console.error("REGISTRATION ERROR:", error);

        return res.status(400).json({
            error: error.message
        });
    }
};


// Login User
exports.loginUser = async (req, res) => {

    try {

        const { email, password } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({
                error: 'Invalid credentials'
            });
        }

        const isMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!isMatch) {
            return res.status(400).json({
                error: 'Invalid credentials. Please signup first or use correct password'
            });
        }

        // Send new OTP if account is not verified
        if (!user.isVerified && user.role === 'user') {

            const otp = Math.floor(
                100000 + Math.random() * 900000
            ).toString();

            await OTP.deleteMany({
                email,
                action: 'account_verification'
            });

            await OTP.create({
                email,
                otp,
                action: 'account_verification'
            });

            // FIXED
            await sendOTPEmail(
                email,
                otp,
                'account_verification'
            );

            return res.status(400).json({
                error: 'Account not verified. A new OTP has been sent to your email.'
            });
        }

        res.json({
            message: 'Login Successful',
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: generateToken(
                user._id,
                user.role
            )
        });

    } catch (error) {

        console.error('Login error:', error);

        res.status(500).json({
            error: error.message
        });
    }
};


// Verify OTP
exports.verifyOtp = async (req, res) => {

    try {

        const { email, otp } = req.body;

        const otpRecord = await OTP.findOne({
            email,
            otp,
            action: 'account_verification'
        });

        if (!otpRecord) {
            return res.status(400).json({
                error: 'Invalid or expired OTP'
            });
        }

        const user = await User.findOneAndUpdate(
            { email },
            { isVerified: true },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        await OTP.deleteMany({
            email,
            action: 'account_verification'
        });

        res.json({
            message: 'Account verified successfully. You can now log in',
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: generateToken(
                user._id,
                user.role
            )
        });

    } catch (error) {

        console.error('OTP verification error:', error);

        res.status(500).json({
            error: error.message
        });
    }
};