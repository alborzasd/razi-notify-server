const express = require("express");
const { model: UserModel } = require("../models/User");
const router = express.Router();
const jwt = require("jsonwebtoken");

const { requireAuth } = require("../middlewares/authMiddleware");
const { JwtSecret, authTokenExpireSeconds } = require("../config");

const handleErrors = (err) => {
  let status = 401;
  const errors = {};

  if (err.message === "empty username") {
    errors.username = "نام کاربری نمیتواند خالی باشد";
  } else if (err.message === "empty password") {
    errors.password = "رمز عبور نمیتواند خالی باشد";
  } else if (err.message === "username does not exist") {
    errors.username = "نام کاربری در سامانه ثبت نشده است.";
  } else if (err.message === "incorrect password") {
    errors.password = "رمز عبور صحیح نیست.";
  } else {
    errors.message = err.message;
    status = 500;
  }

  return { status, errors };
};

// create token after successfully login or signup
const maxAge = authTokenExpireSeconds;
const createToken = (id) => {
  return jwt.sign({ id }, JwtSecret, {
    expiresIn: maxAge,
  });
};

// router.post('/signup', (req, res) => {
//     // TODO: after create user in db
//     // const token = createToken('user._id');
//     // res.cookie('jwt', token, {httpOnly: true, maxAge: maxAge * 1000});

//     res.json({message: 'POST /auth/signup'});
// });

// TODO: error response if user is already login ('you must logout first to login another account if you want')
// TODO: user object in /login and /info is repeated. and also every time schema changes we have to change here too
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await UserModel.login(username, password);
    const token = createToken(user._id);
    if (req.header("x-device") === "phone") {
      res.json({
        data: {
          user,
          accessToken: token,
        },
      });
    } else {
      // TODO: check sameSite='strcit' with different subdomains (admin.razi-notify.ir and api.razi-notify.ir) (subdomain has effect?)
      res.cookie("jwt", token, {
        httpOnly: true,
        maxAge: maxAge * 1000,
        sameSite: "strict",
      });
      res.status(200).json({
        data: {
          user,
        },
      });
    }
    // TODO: open socket connection here ?
  } catch (err) {
    const { status, errors } = handleErrors(err);
    res.status(status).json({ error: errors });
  }
});

// request is sent by web client to check if it has access token cookie
router.get("/info", requireAuth, async (req, res) => {
  return res.json({ data: { user: req.auth.user } });
});

router.get("/logout", requireAuth, (req, res) => {
  // replace existing jwt coockie with empty string and set a short expire date
  try {
    // res.status(500).json({error: {message: err.message}});
    res.cookie("jwt", "", { maxAge: 1 });
    res.json({ data: { message: "Logout successfully" } });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }

  // TODO: close socket connection here ? what about token expire?
});

module.exports = router;
