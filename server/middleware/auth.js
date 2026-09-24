const jwt = require('jsonwebtoken')
const User = require('../models/User.js')
// User authentication Middleware 
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return res.status(401).json({
      message: "Not authorized, no token"
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = await User.findById(decoded.id).select("-password");

    if (!req.user) {
      return res.status(401).json({
        message: "Not authorized, user not found"
      });
    }

    next();
  }  catch (err) {
    console.error('JWT ERROR:', err.message);

    return res.status(401).json({
        message: "Not authorized, token failed"
    });
}
};
const admin= (req , res , next)=>{
if(req.user && req.user.role === 'admin'){
  next();
}
else{
 return res.status(403).json({message:'Forbidden , admin access required'}) ;
}
}
module.exports = {protect , admin} ;