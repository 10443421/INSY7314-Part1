const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    //read the authorizzation header from HTTP request
    const authHeader = req.headers.authorization;

    //checks if header exists and starts with Bearer
    if(!authHeader || !authHeader.startWith('Bearer')){
        return res.status(401).json({error: 'Access denied. No token provided'});
    }

    const token = authHeader.split(' ')[1];

    try{
        //Veryrify token was signed with correct secret
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');

        //stores decoded token payload
        req.user = decoded;

        next();
    }catch(err){
        return res.status(403).json({error: 'Invalid or expired token'});
    }

};

module.exports = verifyToken;