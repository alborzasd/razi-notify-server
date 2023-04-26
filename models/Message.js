const mongoose = require('mongoose');
const {collectionName: channelCollectionName} = require('./Channel');
const collectionName = 'Messages';

// TODO: create index on channel_id

const messageSchema = new mongoose.Schema({

    body: {
        type: String,
        required: true
        //TODO: ckeditor(bold italic size emoji link image fileToDownload)
    },
    channel_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: channelCollectionName
    }
    // publisher_user_id: {

    // }

}, {collection: collectionName, timestamps: true});

module.exports = {
    model: mongoose.model(collectionName, messageSchema),
    collectionName
}