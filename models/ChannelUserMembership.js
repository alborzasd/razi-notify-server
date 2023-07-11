const mongoose = require('mongoose');
const collectionName = 'ChannelUserMembership';

const {collectionName: userCollectionName} = require('./User');
const {collectionName: channelCollectionName} = require('./Channel');
const constants = require('./Constans');

// TODO: add validation or index for unique combination of user_id, channel_id

const schema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: userCollectionName
    },
    channel_id: {
        type: mongoose.Schema.Types.ObjectId,
        require: true,
        ref: channelCollectionName
    },
    member_role: {
        type: String,
        required: true,
        enum: {
            values: constants.memberRoleValues,
            message: 'مقادیر معتبر شامل این مقدار نمی باشد.'
        },
        default: constants.memberRoleValues[0] // 'member'
    }
}, {collection: collectionName, timestamps: true});

module.exports = {
    model: mongoose.model(collectionName, schema),
    collectionName
}