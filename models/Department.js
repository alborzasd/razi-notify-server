const mongoose = require('mongoose');
const collectionName = 'Departments';

const departmentSchema = new mongoose.Schema({
    title: {
        type: String,
        unique: true,
        required: [true, 'عنوان نمیتواند خالی باشد.']
    },
    type: {
        type: String // "default"
    }
}, {collection: collectionName, timestamps: true});


module.exports = {
    model: mongoose.model(collectionName, departmentSchema),
    collectionName
}