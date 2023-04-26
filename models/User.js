const mongoose = require('mongoose');
const collectionName = 'Users';

const bcrypt = require('bcrypt');
const {isEmail} = require('validator');

const userSchema = new mongoose.Schema({

    username: {
        type: String,
        required: [true, 'نام کاربری نمیتواند خالی باشد.'],
        unique: true,
        __onCreateBind: true
    },
    password: {
        // TODO: hash password before saving to db
        type: String,
        required: [true, 'رمز عبور نمیتواند خالی باشد.'],
        __onCreateBind: true
    },

    first_name: {
        type: String,
        required: [true, 'نام نمیتواند خالی باشد.'],
        __onCreateBind: true
    },
    last_name: {
        type: String,
        required: [true, 'نام خانوادگی نمیتواند خالی باشد.'],
        __onCreateBind: true
    },
    system_role: { // user, admin, root admin, ...
        type: String, // TODO: type enum (or array of strings that only on of it's memebers can be accepted as value)
        required: [true, 'نقش کاربر در سامانه باید مشخص باشد.'],
        __onCreateBind: true
    },
    organization_role: { // student, teacher, system admin, ...
        type: String, // TODO: type enum (or array of strings that only on of it's memebers can be accepted as value)
        required: [true, 'نقش سازمانی کاربر باید مشخص باشد.'],
        __onCreateBind: true
    },
    organization_entrance_date: { // what year the student/teacher entered the university (1mehr 14xx, 1bahman 14xx)
        // must be unix timestamp
        type: Date,
        required: [true, 'سال ورودی دانشجو/کاربر باید مشخص باشد'],
        __onCreateBind: true
    },
    education_field: { // what year the student/teacher entered the university (1mehr 14xx, 1bahman 14xx)
        type: String,
        required: [true, 'رشته تحصیلی باید مشخص باشد.'],
        __onCreateBind: true
    },

    // additional info
    phone_number: { // send message through sms or password reset
        type: String,
        unique: true,
        sparse: true,
        __onCreateBind: true
        // TODO: regex validation for phone number
    },
    email: { // password reset
        type: String,
        unique: true,
        sparse: true, // check unique if not null (may be 2 users have no email)
        validate: [isEmail, 'ایمیل وارد شده صحیح نیست.'],
        __onCreateBind: true
    },
    profile_image_url: {
        type: String
    }
}, {collection: collectionName, timestamps: true});


userSchema.pre('save', async function(next){
    const salt = await bcrypt.genSalt();
    this.password = await bcrypt.hash(this.password, salt);
    next();
})


// static method to login user
userSchema.statics.login = async function(username, password) {
    // 'this' refers to user model (not instace)
    if(!username){
        throw Error('empty username');
    }
    if(!password){
        throw Error('empty password');
    }
    const user = await this.findOne({username});
    // console.log(user);
    if(user){
        const auth = await bcrypt.compare(password, user.password);
        if(auth) {
            return user;
        }
        throw Error('incorrect password');
    }
    throw Error('username does not exist');
}

userSchema.statics.getOnCreateBindAllowedProperties = () => {
    result = []
    for(let property in userSchema.paths){
        if(userSchema.paths[property].options.__onCreateBind) {
            result.push(property);
        }
    }
    return result;
}



module.exports = {
    model: mongoose.model(collectionName, userSchema),
    collectionName
} 