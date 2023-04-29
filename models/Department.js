const mongoose = require('mongoose');
const collectionName = 'Departments';

const departmentSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'عنوان نمیتواند خالی باشد.']
    }
}, {collection: collectionName, timestamps: true});


module.exports = {
    model: mongoose.model(collectionName, departmentSchema),
    collectionName
}