const {
  collectionName: departmentCollectionName,
} = require("../models/Department");

const { model: UserModel } = require("../models/User");

const {
  model: MessageModel,
  collectionName: messagesCollectionName,
} = require("../models/Message");

const {
  model: ChannelUserMembershipModel,
  collectionName: channelUserMembershipCollectionName,
} = require("../models/ChannelUserMembership");

const {
  collectionName: channelsCollectionName,
  model: ChannelModel,
} = require("../models/Channel");

const ObjectId = require("mongoose").Types.ObjectId;

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
        ? "نام کاربری وارد شده با یکی دیگر از ردیف ورودی یا ثبت شده در سامانه یکسان است."
        : "شناسه تکراری";
  } else if (err?.name === "SmsManagerError") {
    status = err?.networkResponseStatus;
    errorData.message = err?.message;
  } else {
    status = 500;
    errorData.message = err?.message;
  }

  return { status, errorData };
}

function isValidObjectId(str) {
  if (ObjectId.isValid(str)) {
    if (String(new ObjectId(str)) === str) return true;
    return false;
  }
  return false;
}

// utility function that handles user aggregation
// and is used by users and channelMembers route handlers
function generateUserAggregationStages($preMatch, pageNum, pageSize) {
  // to disable pagination
  // pageSize must be set to 0
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
        entities:
          pageSize > 0
            ? [{ $skip: (pageNum - 1) * pageSize }, { $limit: pageSize }]
            : // skip 0, it's a no op stage
              [{ $skip: 0 }],
        count: [{ $count: "totalCount" }],
      },
    },
  ];
}

// delete usernames with all channels, channel messages and channel memberships
async function cascadeDeleteManyUsers(rootAdminUsername, usernames, session) {
  // exclude rootAdmin from usernames
  const usernamesToDelete = usernames
    .map((username) => username.toString())
    .filter((username) => rootAdminUsername !== username);

  // TODO: nested lookup should be used with unwind stage
  // if we use nested lookup with pipline inside each $lookup
  // the result is like tree
  // but we need a flat _ids of users, channels, messages and memberships
  // to delete them at once, also as fast as possible
  const result = await UserModel.aggregate([
    { $match: { username: { $in: usernamesToDelete } } },

    {
      $lookup: {
        from: channelsCollectionName,
        localField: "_id",
        foreignField: "owner_id",
        as: "channels",
      },
    },
    /////////////////////////////////////////////////////////////////
    // {
    //   $facet: {
    //     user_list: [
    //       {
    //         $project: {
    //           user_id: "$_id",
    //           username: "$username",
    //           fullname: { $concat: ["$first_name", " ", "$last_name"] },
    //         },
    //       },
    //     ],

    //     other: [
    //       { $unwind: { path: "$channels", preserveNullAndEmptyArrays: true } },

    //       {
    //         $project: {
    //           channel_id: "$channels._id",
    //           channel_title: "$channels.title",
    //         },
    //       },

    //       {
    //         $facet: {
    //           channel_list: [
    //             {
    //               $project: {
    //                 channel_id: 1,
    //                 channel_title: 1,
    //               },
    //             },
    //           ],

    //           message_list: [
    //             {
    //               $lookup: {
    //                 from: messagesCollectionName,
    //                 localField: "channel_id",
    //                 foreignField: "channel_id",
    //                 as: "messages",
    //               },
    //             },
    //             {
    //               $unwind: {
    //                 path: "$messages",
    //                 preserveNullAndEmptyArrays: true,
    //               },
    //             },
    //             {
    //               $project: {
    //                 // fullname: 1,
    //                 // channel_title: 1,
    //                 // messages: 1,
    //                 message_id: "$messages._id",
    //                 message_title: "$messages.title",
    //                 message_body: "$messages.body",
    //               },
    //             },
    //           ],

    //           membership_list: [
    //             {
    //               $lookup: {
    //                 from: channelUserMembershipCollectionName,
    //                 localField: "channel_id",
    //                 foreignField: "channel_id",
    //                 as: "memberships",
    //               },
    //             },
    //             {
    //               $unwind: {
    //                 path: "$memberships",
    //                 preserveNullAndEmptyArrays: true,
    //               },
    //             },
    //             {
    //               $project: {
    //                 // fullname: 1,
    //                 // channel_title: 1,
    //                 // messages: 1,
    //                 membership_id: "$memberships._id",
    //                 membership_title: "$memberships.title",
    //                 membership_body: "$memberships.body",
    //               },
    //             },
    //           ],
    //         },
    //       },
    //     ],
    //   },
    // },
    /////////////////////////////////////////
    { $unwind: { path: "$channels", preserveNullAndEmptyArrays: true } },

    {
      $project: {
        user_id: "$_id",
        username: "$username",
        fullname: { $concat: ["$first_name", " ", "$last_name"] },
        channel_id: "$channels._id",
        channel_title: "$channels.title",
      },
    },

    {
      $facet: {
        user_list: [
          {
            $project: {
              user_id: 1,
              username: 1,
              fullname: 1,
            },
          },
          {
            $group: {
              _id: "$user_id",
              username: { $first: "$username" },
              fullname: { $first: "$fullname" },
            },
          },
        ],

        channel_list: [
          {
            $project: {
              channel_id: 1,
              channel_title: 1,
            },
          },
        ],

        message_list: [
          {
            $lookup: {
              from: messagesCollectionName,
              localField: "channel_id",
              foreignField: "channel_id",
              as: "messages",
            },
          },
          { $unwind: { path: "$messages", preserveNullAndEmptyArrays: true } },
          {
            $project: {
              // fullname: 1,
              // channel_title: 1,
              // messages: 1,
              message_id: "$messages._id",
              message_title: "$messages.title",
              message_body: "$messages.body",
            },
          },
        ],

        membership_list: [
          {
            $lookup: {
              from: channelUserMembershipCollectionName,
              localField: "channel_id",
              foreignField: "channel_id",
              as: "memberships",
            },
          },
          {
            $unwind: { path: "$memberships", preserveNullAndEmptyArrays: true },
          },
          {
            $project: {
              // fullname: 1,
              // channel_title: 1,
              // messages: 1,
              membership_id: "$memberships._id",
              membership_title: "$memberships.title",
              membership_body: "$memberships.body",
            },
          },
        ],
      },
    },
    ////////////////////////////////////////////////////////////////
    // {
    //   $lookup: {
    //     from: messagesCollectionName,
    //     localField: "channels._id",
    //     foreignField: "channel_id",
    //     as: "messages",
    //   },
    // },
    // { $unwind: { path: "$messages", preserveNullAndEmptyArrays: true } },
  ]);

  // prepare ids to delete
  const usersToDelete = result?.[0]?.user_list;
  const userIdsToDelete = usersToDelete?.map((user) => user?._id);

  const channelIdsToDelete = result?.[0]?.channel_list
    ?.filter((channel) => Boolean(channel?.channel_id))
    .map((channel) => channel?.channel_id);

  const messageIdsToDelete = result?.[0]?.message_list
    ?.filter((message) => Boolean(message?.message_id))
    .map((message) => message?.message_id);

  const membershipIdsToDelete = result?.[0]?.membership_list
    ?.filter((membership) => Boolean(membership?.membership_id))
    .map((membership) => membership?.membership_id);

  // when a user is going to be deleted
  // his _id must be deleted from membership collection
  // so remaining channels not having that user any more
  let membershipIdsForUserIdsToDelete = await ChannelUserMembershipModel.find({
    user_id: { $in: userIdsToDelete },
  });
  membershipIdsForUserIdsToDelete = membershipIdsForUserIdsToDelete.map(
    (membership) => membership?._id
  );

  // delete transaction
  await ChannelUserMembershipModel.deleteMany(
    {
      _id: {
        $in: membershipIdsToDelete,
      },
    },
    { session }
  );
  await ChannelUserMembershipModel.deleteMany(
    {
      _id: {
        $in: membershipIdsForUserIdsToDelete,
      },
    },
    { session }
  );

  await MessageModel.deleteMany(
    {
      _id: { $in: messageIdsToDelete },
    },
    { session }
  );

  await ChannelModel.deleteMany(
    {
      _id: { $in: channelIdsToDelete },
    },
    { session }
  );

  await UserModel.deleteMany(
    {
      _id: { $in: userIdsToDelete },
    },
    { session }
  );

  return usersToDelete;
}

// delete a channel with all messsages and memberships
async function cascadeDeleteChannel(channelDoc, session) {
  await MessageModel.deleteMany({ channel_id: channelDoc._id }, { session });
  // throw new Error("test");
  await ChannelUserMembershipModel.deleteMany(
    { channel_id: channelDoc._id },
    { session }
  );

  await channelDoc.remove({ session });
}

// controller
async function getMyOwnChannelsController(req, res) {
  try {
    const userId = req?.auth?.user?._id;
    // filter by channel title or identifier
    const searchValue = req?.query?.searchValue;

    // pass this match object to find query
    const $preMatch = {
      owner_id: userId,
    };

    if (searchValue) {
      $preMatch.$or = [
        { title: { $regex: searchValue, $options: "i" } },
        { identifier: { $regex: searchValue, $options: "i" } },
      ];
    }

    const channels = await ChannelModel.find($preMatch);

    return res.json({
      data: channels,
    });
  } catch (err) {
    const { status, errorData } = handleErrors(err, "channels");
    return res.status(status).json({ error: errorData });
  }
}

// get and array of phone numbers to send them
// to the sms api
async function getMemberPhoneNumbers(channelId) {
  const memberships = await ChannelUserMembershipModel.find({
    channel_id: channelId,
  })
    .lean()
    .populate("user", "phone_number");

  return memberships
    .map((membership) => membership?.user?.phone_number)
    .filter((phone_number) => Boolean(phone_number));
}

module.exports = {
  handleErrors,
  isValidObjectId,
  generateUserAggregationStages,
  cascadeDeleteManyUsers,
  cascadeDeleteChannel,
  getMyOwnChannelsController,
  getMemberPhoneNumbers,
};
