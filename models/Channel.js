const mongoose = require('mongoose');
const collectionName = 'Channels';

const {collectionName: userCollectionName} = require('./User');

const channelSchema = new mongoose.Schema({
    identifier: {
        type: String,
        required: true,
        unique: true
        //TODO: regex validation (only alphanumeric, hyphen, underscore, english, case insensitive compare)
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: userCollectionName
    },
    profile_image_url: {
        type: String,
    }

    // TODO: add relation to User model (creator of the channel)
    // user_id: {

    // }
}, {collection: collectionName, timestamps: true}); // force to create collection with exact name

module.exports = {
    model: mongoose.model(collectionName, channelSchema),
    collectionName 
}