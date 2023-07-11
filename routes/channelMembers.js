const express = require("express");
const {
  model: ChannelUserMembershipModel,
} = require("../models/ChannelUserMembership");
const { collectionName: userCollectionName } = require("../models/User");

const {
  // getChannel,
  requireChannelOwnership,
} = require("../middlewares/channelMiddlewares");

const { handleErrors, generateUserAggregationStages } = require("./utilities");

const Constants = require("../models/Constans");

const router = express.Router();

// get members of a channel
router.get("/", async (req, res) => {
  const channelDoc = req.channel;

  const searchField = req.query.searchField || null;
  const searchValue = req.query.searchValue || null;

  let pageNum = parseInt(req.query.pageNum);
  pageNum = !isNaN(pageNum) && pageNum > 0 ? pageNum : 1;

  // if pageSize in query was 0 or any value that is parsed to NaN
  // set pageSize to 10
  let pageSize = parseInt(req.query.pageSize);
  pageSize = !isNaN(pageSize) && pageSize > 0 ? pageSize : 10;

  // before lookup for users
  const $preMatch = {
    channel_id: channelDoc._id,
  };
  // after lookup for users
  // it will be passed to $preMatch param in the generateStage function
  const $postMatch = {};

  if (searchValue) {
    if (searchField === "username") {
      $postMatch.username = { $regex: searchValue, $options: "i" };
    } else if (searchField === "fullname") {
      $postMatch.$or = [
        { first_name: { $regex: searchValue, $options: "i" } },
        { last_name: { $regex: searchValue, $options: "i" } },
      ];
    } else if (searchField === "system_role") {
      $postMatch.system_role = searchValue; // exact match
    } else if (searchField === "student_position") {
      $postMatch.student_position = searchValue;
    } else if (searchField === "lecturer_position") {
      $postMatch.lecturer_position = searchValue;
    } else if (searchField === "employee_position") {
      $postMatch.employee_position = { $regex: searchValue, $options: "i" };
    } else if (searchField === "department_id") {
      $postMatch.department_id = mongoose.Types.ObjectId(searchValue);
    }
  }

  try {
    const result = await ChannelUserMembershipModel.aggregate([
      { $match: $preMatch },
      // get user info from each user_id
      {
        $lookup: {
          from: userCollectionName,
          localField: "user_id",
          foreignField: "_id",
          as: "user",
        },
      },
      // user info returned by prev stage is array
      // get first element or null (if empty) and override the 'user' field
      {
        $addFields: {
          user: {
            $cond: {
              if: { $gt: [{ $size: "$user" }, 0] },
              then: { $arrayElemAt: ["$user", 0] },
              else: null,
            },
          },
        },
      },
      // // destructure user fields
      // {
      //   $addFields: {
      //     $mergeObjects: "$user",
      //   },
      // },
      // inclusion projection
      {
        $project: {
          // flatten nested user object
          _id: "$user._id",
          username: "$user.username",
          first_name: "$user.first_name",
          last_name: "$user.last_name",
          system_role: "$user.system_role",
          student_position: "$user.student_position",
          lecturer_position: "$user.lecturer_position",
          employee_position: "$user.employee_position",
          department_id: "$user.department_id",
          profile_image_url: "$user.profile_image_url",

          //convert createAt to joined_at
          joined_at: "$createdAt",
          // keep these fields
          member_role: 1,

          // these fields will be excluded
          // channel_id, user_id, user, createdAt
        },
      },
      // exclusion projection
      // {
      //   $project: {
      // remove these fields
      // channel_id: 0,
      // user_id: 0,
      // user: 0,
      // createdAt: 0, // this is for date of when membership record has been created
      //   }
      // }
      // convert createAt to joined_at
      // {
      //   $addFields: {
      //     joined_at: "$createdAt",
      //   },
      // },
      // remove channel_id, user_id, user, createdAt field
      // keep joined_at, member_role and user nested fields
      // {
      //   $project: {
      //     channel_id: 0,
      //     user_id: 0,
      //     user: 0,
      //     createdAt: 0,
      //   },
      // },

      // pass result to user aggregation stages (same as GET /users route)
      ...generateUserAggregationStages($postMatch, pageNum, pageSize),
    ]);

    const entities = result[0]?.entities || [];
    const totalCount = result[0]?.count[0]?.totalCount || 0;

    res.send({
      data: {
        entities,
        meta: {
          pageNum,
          pageSize,
          totalCount,
        },
        // client will use these dictionaries to translate fields of entities
        systemRoleEnumPersian: Constants.systemRoleEnumPersian,
        studentPositionEnumPersian: Constants.studentPositionEnumPersian,
        lecturerPositionEnumPersian: Constants.lecturerPositionEnumPersian,
        memberRoleEnumPersian: Constants.memberRolesEnumPersian,
      },
    });
  } catch (err) {
    const { status, errorData } = handleErrors(err, "users");
    return res.status(status).json({ error: errorData });
  }
});

module.exports = router;