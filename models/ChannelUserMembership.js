const mongoose = require("mongoose");
const collectionName = "ChannelUserMembership";

const { collectionName: userCollectionName } = require("./User");
const { collectionName: channelCollectionName } = require("./Channel");
const constants = require("./Constans");

const schema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: userCollectionName,
    },
    channel_id: {
      type: mongoose.Schema.Types.ObjectId,
      require: true,
      ref: channelCollectionName,
    },
    member_role: {
      type: String,
      required: true,
      enum: {
        values: constants.memberRoleValues,
        message: "مقادیر معتبر شامل این مقدار نمی باشد.",
      },
      default: constants.memberRoleValues[0], // 'member'
    },

    // derived fields (start with 'der_' prefix)

    // when a new member added to a channel
    // this field has no value, after that
    // when a channel title, identifier, description is updated
    // this field is also updated (to the updatedAt value of that channel)
    // the sync route handler will read this field
    // to find which joined channels are updated after a given timestamp
    // so the handler does not need to lookup the whole channels every time
    der_channelUpdatedAt: {
      type: Date,
      // required: true,
    },
    // stores the current last message for channel_id
    der_lastMessage: {},
    // stores the last message that user has read
    der_lastMessageRead: {},
    // number of unread messages (count from lastMessageRead to lastMessage)
    der_numUnreadMessages: {
      type: Number
    },
    // if any message added, edited, deleted in the channel_id
    // the timestamp of the last operation will store here
    // with this field, server can detect send updated last message to client or not
    der_messageCollectionUpdatedAt: {
      type: Date
    }
  },
  {
    collection: collectionName,
    timestamps: true,
    /*toObject: {virtuals: true},*/
  }
);

// define unique index for combination of user_id and channel_id
schema.index({ user_id: 1, channel_id: 1 }, { unique: true });

schema.virtual("user", {
  ref: userCollectionName,
  localField: "user_id",
  foreignField: "_id",
  justOne: true,
});

module.exports = {
  model: mongoose.model(collectionName, schema),
  collectionName,
};
