const {
  collectionName: departmentCollectionName,
} = require("../models/Department");

// utility function to handle validation or server error
function handleErrors(err, resourceName) {
  let status = 400; // assume that it's a validation error
  const errorData = {};

  if (err?.name === "ValidationError") {
    Object.keys(err?.errors).forEach((key) => {
      errorData[key] = err?.errors?.[key]?.message;
    });
  } else if (err?.code === 11000) {
    errorData.message = "Duplicate key error";
    errorData.messagePersian =
      resourceName === "channels"
        ? "شناسه وارد شده متعلق به کانال دیگری است."
        : resourceName === "users"
        ? "نام کاربری وارد شده قبلا در سامانه ثبت شده است"
        : "شناسه تکراری";
  } else {
    status = 500;
    errorData.message = err?.message;
  }

  return { status, errorData };
}

// utility function that handles user aggregation
// and is used by users and channelMembers route handlers
function generateUserAggregationStages($preMatch, pageNum, pageSize) {
  return [
    { $match: $preMatch },
    // get deparment info of each user
    {
      $lookup: {
        from: departmentCollectionName,
        localField: "department_id",
        foreignField: "_id",
        as: "department",
      },
    },
    // department value returned by the previous stage is array
    // get first element or null (if empty) and override the 'department' field
    {
      $addFields: {
        department: {
          $cond: {
            if: { $gt: [{ $size: "$department" }, 0] },
            then: { $arrayElemAt: ["$department", 0] },
            else: null,
          },
        },
      },
    },
    // specify fields that are not allowed to be sent
    {
      $project: {
        password: 0,
      },
    },
    // sort should be after filter, before pagination
    {
      $sort: {
        _id: -1,
      },
    },
    {
      $facet: {
        entities: [{ $skip: (pageNum - 1) * pageSize }, { $limit: pageSize }],
        count: [{ $count: "totalCount" }],
      },
    },
  ];
}

module.exports = {
  handleErrors,
  generateUserAggregationStages,
};
