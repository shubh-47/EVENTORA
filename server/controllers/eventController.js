const Event = require('../models/Event.js');
const User = require('../models/User.js');
exports.getAllEvents= async(req, res)=>{
  try{
    const filters ={};
    if(req.query.category){
      filters.category = req.query.category ;
    }
    if(req.query.location){
      filters.location = req.query.location ;
    }
    if(req.query.ticketPrice){
      filters.ticketPrice = req.query.ticketPrice ;
    }
const events = await Event.find(filters);
res.json(events) ;
  }
  catch(error){
    res.status(500).json({error: error.message});
  }
};

exports.getEventById = async (req , res)=>{
  try{
    const event = await Event.findById(req.params.id);
    if(!event){
      return res.status(404).json({error:'Event not Found'});
    }
    res.json(event) ;
  }
  catch(error){
return res.status(500).json({error:error.message}) ;
  }
} ;

exports.createEvent = async (req, res) => {

    const {
        title,
        description,
        date,
        location,
        category,
        totalSeats,
        ticketPrice,
        imageUrl
    } = req.body;

    try {

        // Check date
        const eventDate = new Date(date);

        if (isNaN(eventDate.getTime())) {
            return res.status(400).json({
                error: "Invalid date. Use format YYYY-MM-DD"
            });
        }

        const event = await Event.create({

            title,

            description,

            date: eventDate,

            location,

            category,

            totalSeats,

            availableSeats: totalSeats,

            ticketPrice,

            imageUrl,

            createdBy: req.user._id
        });

        res.status(201).json(event);

    } catch (error) {

        res.status(500).json({
            error: error.message
        });

    }
};

exports.updateEvent = async( req , res)=>{
  const {title , description , date  , location , category , totalSeats ,    availableSeats ,ticketPrice ,imageUrl} = req.body ;
  try{
const event = await Event.findByIdAndUpdate(req.params.id, {
  title , 
description ,
 date  ,
  location ,
   category , 
   totalSeats , 
   availableSeats ,
   ticketPrice ,
   imageUrl
},  {new : true  , runValidators : true}) ;
if(!event){
  return res.status(404).json({error: 'Event not found'})
}
res.json(event)

  }
  catch(error){
 res.status(500).json({error:error.message}) ;
  }
};

exports.deleteEvent = async(req, res)=>{
try{
const event = await Event.findByIdAndDelete(req.params.id);
if(!event){
  return res.status(404).json({error: 'Event not Found'}) ;
}
res.json({message:"Event deleted successfully"})
}
catch(error){
res.status(500).json({error: error.message})
}
}

