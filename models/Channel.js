const mongoose = require("mongoose");
const collectionName = "Channels";

const { collectionName: userCollectionName } = require("./User");
const { identifierNamingErrorMessage } = require("./Constans");

const channelSchema = new mongoose.Schema(
  {
    identifier: {
      type: String,
      required: true,
      unique: true, // not necessary here (but necessary for identifier_lowercase)
      validate: {
        validator: function (value) {
          return /^[A-Za-z][A-Za-z0-9-_]{3,}$/.test(value);
        },
        message: identifierNamingErrorMessage,
      },
      __onCreateBindAllowed: true,
      __onUpdateBindAllowed: true,
    },
    // this field is assiged before update and insert
    // when finding channel by identifier, this field will be used
    // so user does not have to remember the exact capitalization to search identifier
    // but the exact capitalization will be used to show the result (from 'identifier' above)
    identifier_lowercase: {
      type: String,
      // mongoose gives error if we dont assign it manually.
      // but pre save function will alaways assign the required 'identifier' value to it
      // required: true,
      unique: true, // necessary here
    },
    title: {
      type: String,
      required: true,
      __onCreateBindAllowed: true,
      __onUpdateBindAllowed: true,
    },
    description: {
      type: String,
      __onCreateBindAllowed: true,
      __onUpdateBindAllowed: true,
    },
    owner_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: userCollectionName,
    },
    profile_image_url: {
      type: String,
    },
  },
  {
    collection: collectionName,
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
); // force to create collection with exact name with 'collection' option

channelSchema.pre("save", function (next) {
  this.identifier_lowercase = this.identifier.toLowerCase();
  next();
});

channelSchema.virtual("owner", {
  ref: userCollectionName,
  localField: "owner_id",
  foreignField: "_id",
  justOne: true, // only get the first match (instead of array)
});

channelSchema.statics.getOnCreateBindAllowedFields = function () {
  const result = [];
  for (const field in channelSchema.paths) {
    if (channelSchema.paths[field].options.__onCreateBindAllowed) {
      result.push(field);
    }
  }
  return result;
}

channelSchema.statics.getOnUpdateBindAllowedFields = function () {
  const result = [];
  for (const field in channelSchema.paths) {
    if (channelSchema.paths[field].options.__onUpdateBindAllowed) {
      result.push(field);
    }
  }
  return result;
};

module.exports = {
  model: mongoose.model(collectionName, channelSchema),
  collectionName,
};
