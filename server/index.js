const express = require('express')
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const cors = require('cors')
const cookieParser = require("cookie-parser");

const authRoutes = require('../server/routes/auth.js')
const eventRoutes = require('../server/routes/events.js')
const bookingRoutes = require('../server/routes/booking.js')
const paymentRoutes = require('../server/routes/payment.js');
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json())
app.use(cookieParser());
//Routes 
app.use('/api/auth' ,authRoutes) ;
app.use('/api/event',eventRoutes )
app.use('/api/booking',bookingRoutes )
app.use('/api/payment', paymentRoutes);
//MONGO Connection
mongoose.connect(process.env.MONGODB_URI)
.then(()=>{
  console.log(`Connected to mongoDB`) ;
})
.catch((error)=>{
  console.error(`Error in connecting to  MongoDB:`, error);
});

const PORT = process.env.PORT ;
app.listen(PORT ,()=>{
console.log(`Server is running on port ${PORT}`)
})
