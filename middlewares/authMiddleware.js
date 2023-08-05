const jwt = require("jsonwebtoken");
const { JwtSecret } = require("../config");
const { model: UserModel } = require("../models/User");

const requireAuth = async (req, res, next) => {
  req.auth = {
    user_id: null,
    client: null,
    user: null,
  };
  try {
    let token;
    // check token is from native app or web app
    if (req.header("Authorization") && req.header("x-device") === "phone") {
      // Authorization: Bearer idsfusoid....
      token = req.header("Authorization").split(" ")[1];
      req.auth.client = "phone";
    } else {
      token = req.cookies?.jwt;
      req.auth.client = "web";
    }
    // return 401 for empty token
    if (!token) {
      return res.status(401).json({ error: { message: "You must login" } });
    }
    // decode token, attach user id to req.auth
    // return 401 for invalid token
    let jwtError;
    let decodedToken;
    jwt.verify(token, JwtSecret, (err, token) => {
      jwtError = err;
      decodedToken = token;
    });
    if (jwtError) {
      return res.status(401).json({ error: { message: jwtError.message } });
    }
    req.auth.user_id = decodedToken.id;
    // fetch user from database with decoded user id
    // attach user to req.user
    // return 401 if user does not exist
    const user = await UserModel.findById(req.auth.user_id, {
      password: 0,
    }).populate("department", "title");
    if (!user) {
      return res
        .status(401)
        .json({
          error: { message: "Token is valid but user is removed from db" },
        });
    }
    req.auth.user = user;
    next();
  } catch (err) {
    console.log("Auth Error", err);
    res.status(500).json({ error: { message: err.message } });
  }
};

module.exports = {
  requireAuth,
};
