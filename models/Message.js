const mongoose = require("mongoose");
const collectionName = "Messages";

const { collectionName: channelCollectionName } = require("./Channel");
const { collectionName: userCollectionName } = require("./User");

// TODO: create index on channel_id

const messageSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,

      __onCreateBindAllowed: true,
      __onUpdateBindAllowed: true,
    },
    body: {
      type: String,
      required: true,

      __onCreateBindAllowed: true,
      __onUpdateBindAllowed: true,
    },
    channel_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: channelCollectionName,
    },
    // if it's empty it means the message is sent by the channel owner
    sent_by_user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: userCollectionName,
    },


    // derived fields

    // message body contains json output of the editor
    // this field stores a substring of the raw output
    // from that json
    // TODO: add 'der_' prefix
    bodyRawPreview: {
      type: String,

      __onCreateBindAllowed: true,
      __onUpdateBindAllowed: true,
    },
    
    der_bodyRaw: {
      type: String,

      __onCreateBindAllowed: true,
      __onUpdateBindAllowed: true,
    }
  },
  {
    collection: collectionName,
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

messageSchema.virtual("channel", {
  ref: channelCollectionName,
  localField: "channel_id",
  foreignField: "_id",
  justOne: true,
});

messageSchema.virtual("sent_by_user", {
  ref: userCollectionName,
  localField: "sent_by_user_id",
  foreignField: "_id",
  justOne: true,
});

// returns onCreate or onUpdate bind allowed fields
// with given type parameter ("creaet", "update")
messageSchema.statics.getOnBindAllowedFields = function (operationType) {
  let option;
  if (operationType === "create") {
    option = "__onCreateBindAllowed";
  } else if (operationType === "update") {
    option = "__onUpdateBindAllowed";
  }

  const result = [];
  for (const field in messageSchema.paths) {
    if (messageSchema.paths[field].options?.[option]) {
      result.push(field);
    }
  }
  return result;
};

module.exports = {
  model: mongoose.model(collectionName, messageSchema),
  collectionName,
};
