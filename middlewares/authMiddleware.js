const jwt = require('jsonwebtoken');

const requireAuth = (req, res, next) => {

    const token = req.cookies.jwt;

    if(token){
        jwt.verify(token, process.env.JWT_SECRET, (err, decodedToken) => {
            if(err) {
                return res.status(401).json({message: err.message}); // {message: invalid token, jwt expired, ...}
                // TODO: close socket connection if token expired ?
            }
            else {
                // console.log(decodedToken);
                res.auth = {user_id: decodedToken.id};
                next();
            }
        });
    }
    else {
        return res.status(401).json({message: 'You must login'});
    }

}


module.exports = {
    requireAuth
} 