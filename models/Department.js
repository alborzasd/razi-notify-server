const mongoose = require("mongoose");
const collectionName = "Departments";

const departmentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      unique: true,
      required: [true, "عنوان نمیتواند خالی باشد."],

      __onCreateBindAllowed: true,
      __onUpdateBindAllowed: true,
    },
    type: {
      type: String, // "default"
    },

    // stores the filename with extension
    // but not the directory path
    // the filename contains _id of department
    // plus the sanitized title
    // plus original file extension
    profile_image_filename: {
      type: String
    }
  },
  { collection: collectionName, timestamps: true }
);

// returns onCreate or onUpdate bind allowed fields
// with given type parameter ("creaet", "update")
departmentSchema.statics.getOnBindAllowedFields = function (operationType) {
  let option;
  if (operationType === "create") {
    option = "__onCreateBindAllowed";
  } else if (operationType === "update") {
    option = "__onUpdateBindAllowed";
  }

  const result = [];
  for (const field in departmentSchema.paths) {
    if (departmentSchema.paths[field].options?.[option]) {
      result.push(field);
    }
  }
  return result;
};

module.exports = {
  model: mongoose.model(collectionName, departmentSchema),
  collectionName,
};
