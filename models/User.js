const mongoose = require('mongoose');
const collectionName = 'Users';

const bcrypt = require('bcrypt');
const {isEmail} = require('validator');

const {collectionName: departmentCollectionName} = require('./Department');
const { removeProperties } = require('./utilities');

const chalk = require('chalk');

const userSchema = new mongoose.Schema({
    // TODO: set default value if not provided 

    // TODO: make username and password same as personnel code at first (each user must change his password)
    username: {
        type: String,
        required: [true, 'نام کاربری (کد پرسنلی) نمیتواند خالی باشد.'],
        unique: true,
        __onCreateBind: true
    },
    password: {
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
    system_role: { // user, channel admin, root admin, ...
        type: String, // TODO: type enum (or array of strings that only one of it's memebers can be accepted as value)
        required: [true, 'نقش کاربر در سامانه باید مشخص باشد.'],
        enum: {
            values: ['root_admin', 'channel_admin', 'user'],
            message: 'مقادیر معتبر شامل این مقدار نمی باشد.'
        },
        default: 'user',
        __onCreateBind: true
    },
    // organization_role: { // student, teacher, system admin, ...
    //     type: String, // TODO: type enum (or array of strings that only on of it's memebers can be accepted as value)
    //     required: [true, 'نقش سازمانی کاربر باید مشخص باشد.'],
    //     enum: {
    //         values: ['student', 'professor', 'employee'],
    //         message: 'مقادیر معتبر شامل این مقدار نمی باشد.'
    //     },
    //     default: 'student',
    //     __onCreateBind: true
    // },
    student_position: {
        type: String,
        enum: {
            values: ['bachelor', 'master', 'doctoral'],
            message: 'مقادیر معتبر شامل این مقدار نمی باشد.'
        },
        required: [function(value) {
            // required if lecturer_position and employee_position is empty
            return !this.lecturer_position && !this.employee_position
        }, 'حداقل یکی از موقعیت های استاد، دانشجو یا کارمند باید مشخص باشد.'],
        __onCreateBind: true
    },
    lecturer_position: {
        type: String,
        enum: {
            values: ['sessional instructor', 'instructor', 'assistant professor', 'associate professor', 'professor'],
            message: 'مقادیر معتبر شامل این مقدار نمی باشد.'
        },
        required: [function(value) {
            // required if student_position and employee_position is empty
            return !this.student_position && !this.employee_position
        }, 'حداقل یکی از موقعیت های استاد، دانشجو یا کارمند باید مشخص باشد.'],
        __onCreateBind: true
    },
    employee_position: {
        type: String,
        required: [function(value) {
            // required if student_position and lecturer_position is empty
            return !this.student_position && !this.lecturer_position
        }, 'حداقل یکی از موقعیت های استاد، دانشجو یا کارمند باید مشخص باشد.'],
        __onCreateBind: true
    },
    // organization_entrance_date: { // what year the student/teacher entered the university (1mehr 14xx, 1bahman 14xx)
    //     // must be unix timestamp
    //     type: Date,
    //     required: [true, 'سال ورودی دانشجو/کاربر باید مشخص باشد'],
    //     __onCreateBind: true
    // },
    department: {
        type: mongoose.Schema.Types.ObjectId,
        required: [true, 'دانشکده یا حوزه اداری باید مشخص باشد.'],
        ref: departmentCollectionName,
        __onCreateBind: true
    },

    // additional info
    description: {
        type: String, // more details about user. i.e which office he works (amoozesh)
        __onCreateBind: true
    },
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
        validate: [isEmail, 'ایمیل وارد شده معتبر نیست.'],
        __onCreateBind: true
    },
    profile_image_url: {
        type: String
    }
}, {collection: collectionName, timestamps: true, toJSON: {virtuals: true}, toObject: {virtuals: true}});

userSchema.virtual('student_position_persian').get(function(){
    const persian = {
        ['bachelor']: 'کارشناسی',
        ['master']: 'ارشد',
        ['doctoral']: 'دکتری'
    }
    return persian[this.student_position];
});

userSchema.virtual('lecturer_position_persian').get(function() {
    const persian = {
        ['sessional instructor']: 'حق التدریس',
        ['instructor']: 'مربی',
        ['assistant professor']: 'استادیار',
        ['associate professor']: 'دانشیار',
        ['professor']: 'استاد تمام',
    }
    return persian[this.lecturer_position];
});


userSchema.pre('save', async function(next){
    const salt = await bcrypt.genSalt();
    this.password = await bcrypt.hash(this.password, salt);
    next();
});


function prePopulate() {
    this.populate('department', 'title');
}
userSchema.pre('findOne', prePopulate); // also works for 'findById' used in auth router


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
            return removeProperties(user, 'password');
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