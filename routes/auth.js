const express = require('express');
const {model: UserModel} = require('../models/User');
const router = express.Router();
const jwt = require('jsonwebtoken');

const {requireAuth} = require('../middlewares/authMiddleware');
const { JwtSecret } = require('../config');


const handleErrors = (err) => {

    const errors = {}; 

    if(err.message === 'empty username'){
        errors.username = 'نام کاربری نمیتواند خالی باشد';        
    }
    if(err.message === 'empty password'){
        errors.password = 'رمز عبور نمیتواند خالی باشد';  
    }
    if(err.message === 'username does not exist'){
        errors.username = "نام کاربری وارد شده در سامانه ثبت نشده است.";
    }
    if(err.message === 'incorrect password'){
        errors.password = "رمز عبور صحیح نیست.";
    }

    return errors;

}

// create token after successfully login or signup
const maxAge = 3 * 24 * 60 * 60; // 3 days in seconds
const createToken = (id) => {
    return jwt.sign({id}, JwtSecret, {
        expiresIn: maxAge
    });
}


// router.post('/signup', (req, res) => {
//     // TODO: after create user in db
//     // const token = createToken('user._id');
//     // res.cookie('jwt', token, {httpOnly: true, maxAge: maxAge * 1000});   

//     res.json({message: 'POST /auth/signup'});
// });

// TODO: error response if user is already login ('you must logout first to login another account if you want')
router.post('/login', async (req, res) => {
    const {username, password} = req.body;
    try { 
        const user = await UserModel.login(username, password);
        const token = createToken(user._id);
        res.cookie('jwt', token, {httpOnly: true, maxAge: maxAge * 1000}); 
        res.status(200).json({user: { // everything except password
            username: user.username,
            first_name: user.first_name,
            last_name: user.last_name,
            system_role: user.system_role,
            organization_role: user.organization_role,
            organization_entrance_date: user.organization_entrance_date,
            education_field: user.education_field,
            phone_number: user.phone_number,
            email: user.email,
            profile_image_url: user.profile_image_url
        }});
        // TODO: open socket connection here ?
    }
    catch(err) {
        const errors = handleErrors(err);
        res.status(400).json({errors});
    }
});

// get user info from jwt cookie to check if user is logged in
router.get('/info', requireAuth, async (req, res) => {
    try {
        const user = await UserModel.findById(res.auth.user_id);
        res.status(200).json({user: { // everything except password
            username: user.username,
            first_name: user.first_name,
            last_name: user.last_name,
            system_role: user.system_role,
            organization_role: user.organization_role,
            organization_entrance_date: user.organization_entrance_date,
            education_field: user.education_field,
            phone_number: user.phone_number,
            email: user.email,
            profile_image_url: user.profile_image_url
        }});
    }
    catch(err) {
        res.status(500).json({message: err.message});
    }
});

router.get('/logout', requireAuth, (req, res) => {
    // replace existing jwt coockie with empty string and set a short expire date
    res.cookie('jwt', '', {maxAge: 1});
    res.json({message: 'Logout successfully'});
    // TODO: close socket connection here ? what about token expire? 
});


module.exports = router;