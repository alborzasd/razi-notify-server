const express = require('express');
const {model: UserModel} = require('../models/User');
const router = express.Router();
// const jwt = require('jsonwebtoken');


// takes err from catch(err)
const handleErrors = (err) => {
    // console.log(Object.getOwnPropertyNames(err), err.code);
    console.log(err, Object.keys(err));
    let errors = {};
    // for(let property in UserModel.schema.paths){
    //     errors[property] = ''
    // }

    if(err.code === 11000) { // TODO: what about other unique properties?
        // console.log(Object.keys(err.keyValue));
        const repetitivePropertyName = Object.keys((err.keyValue))[0];
        const message = `این مقدار قبلا ثبت شده و نمیتواند تکراری باشد.`;
        errors[repetitivePropertyName] = message;
        return errors;
    }
    // validation errors
    if(err.message.includes('Users validation failed')){
        Object.values(err.errors).forEach( ({properties}) => {
            errors[properties.path] = properties.message;
        })
    }

    return errors;
}

// create new user by admin
router.post('/', async(req, res) => {
    const allowedProperties = UserModel.getOnCreateBindAllowedProperties();
    const newUserBeforeSave = {};
    for(let allowedProperty of allowedProperties){
        // console.log(UserModel.schema.paths[allowedProperty]);
        newUserBeforeSave[allowedProperty] = req.body[allowedProperty];
    }
    try {
        const newUser = await UserModel.create(newUserBeforeSave);
        res.json(newUser); 
    }
    catch(err) {
        const errors = handleErrors(err);
        res.status(400).json({errors});
    }
});


module.exports = router;