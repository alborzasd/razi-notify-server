const mongoose = require('mongoose');
const collectionName = 'Messages';

const {collectionName: channelCollectionName} = require('./Channel');
const {collectionName: userCollectionName} = require('./User');

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
    },
    // if it's empty it means the message is sent by the channel owner
    sent_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: userCollectionName
    }

}, {collection: collectionName, timestamps: true});

module.exports = {
    model: mongoose.model(collectionName, messageSchema),
    collectionName
}