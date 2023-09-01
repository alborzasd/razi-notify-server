const express = require("express");

const { model: ChannelModel } = require("../models/Channel");

const { collectionName: userCollectionName } = require("../models/User");

const { model: MessageModel } = require("../models/Message");

const {
  model: ChannelUserMembershipModel,
} = require("../models/ChannelUserMembership");

const mongoose = require("mongoose");

const router = express.Router();

const {
  getChannel,
  requireChannelOwnership,
} = require("../middlewares/channelMiddlewares");

const {
  handleErrors,
  cascadeDeleteChannel,
  getMyOwnChannelsController,
} = require("./utilities");

// get all channels, can set filter and pagination
// returns items(entities) with pagination result(meta: totalCount)
router.get("/", async (req, res) => {
  // user wants a little list of his channel
  // go to execute the controller handler that is /channels/?tmeplate=myOwn
  if (req?.query?.template === "myOwn") {
    return await getMyOwnChannelsController(req, res);
  }

  const userId = req.auth.user._id;

  // get query params and set default value if empty
  const searchField = req.query.searchField || null;
  const searchValue = req.query.searchValue || null;
  const myChannels = req.query.myChannels === "true" ? true : false;

  let pageNum = parseInt(req.query.pageNum);
  pageNum = !isNaN(pageNum) && pageNum > 0 ? pageNum : 1;

  // if pageSize in query was 0 or any value that is parsed to NaN
  // set pageSize to 10
  let pageSize = parseInt(req.query.pageSize);
  pageSize = !isNaN(pageSize) && pageSize > 0 ? pageSize : 10;

  // filter before lookup
  const $preMatch = {};
  // filter after lookup
  const $postMatch = {};

  if (myChannels) {
    $preMatch.owner_id = userId;
  }

  if (searchValue) {
    if (searchField === "title") {
      $preMatch.title = { $regex: searchValue, $options: "i" }; // 'i': case insensitive
    } else if (searchField === "identifier") {
      $preMatch.identifier = { $regex: searchValue, $options: "i" }; // 'i': case insensitive
    } else if (searchField === "owner") {
      $postMatch.$or = [
        { "owner.username": { $regex: searchValue, $options: "i" } },
        { "owner.first_name": { $regex: searchValue, $options: "i" } },
        { "owner.last_name": { $regex: searchValue, $options: "i" } },
      ];
    } else if (searchField === "department") {
      // user selects department title in a dropdown
      // but the _id of that is sent to server
      // find channels of a department means
      // find the channels that belong to users of that department
      $postMatch["owner.department_id"] = mongoose.Types.ObjectId(searchValue);
    }
  }

  try {
    // const channels = await ChannelModel.find();
    const result = await ChannelModel.aggregate([
      { $match: $preMatch },
      // get owner of each channel
      {
        $lookup: {
          from: userCollectionName,
          localField: "owner_id",
          foreignField: "_id",
          as: "owner",
        },
      },
      // owner by the previous stage is array
      // get first element or null (if empty) and override the 'owner' field
      {
        $addFields: {
          owner: {
            $cond: {
              if: { $gt: [{ $size: "$owner" }, 0] },
              then: { $arrayElemAt: ["$owner", 0] },
              else: null,
            },
          },
        },
      },
      { $match: $postMatch },
      // specify fields that are not allowed to be sent
      {
        $project: {
          "owner.password": 0,
        },
      },
      // this $sort must be after postMatch and before pagination
      {
        $sort: {
          _id: -1,
        },
      },
      // process pagination and totalCount independently
      // if we use $count stage then we don't have data
      // if we paginate data, then we don't have totalCount
      {
        $facet: {
          entities: [{ $skip: (pageNum - 1) * pageSize }, { $limit: pageSize }],
          count: [{ $count: "totalCount" }],
        },
      },
    ]);

    const entities = result[0]?.entities || [];
    const totalCount = result[0]?.count[0]?.totalCount || 0;

    res.json({
      data: {
        entities,
        meta: {
          //   count: null,
          pageNum,
          pageSize,
          totalCount,
          //   totalPageCount: null,
        },
      },
    });
  } catch (err) {
    const { status, errorData } = handleErrors(err, "channels");
    return res.status(status).json({ error: errorData });
  }
});

// get one channel
// we dont use getChannels middleware here
// because we want to find channel by identifier
// that is different from the _id
router.get("/:identifier", async (req, res) => {
  try {
    const identifier = req.params.identifier;
    const channel = await ChannelModel.findOne({
      identifier_lowercase: identifier.toLocaleLowerCase(),
    }).populate("owner", "first_name last_name");
    if (!channel) {
      return res.status(404).json({
        error: {
          message: `No channel found with identifier ${identifier}`,
          messagePersian: `کانالی با شناسه ${identifier} یافت نشد.`,
        },
      });
    }
    return res.json({
      data: channel,
    });
  } catch (err) {
    const { status, errorData } = handleErrors(err, "channels");
    return res.status(status).json({ error: errorData });
  }
});

// update one channel
router.patch(
  "/:channelId",
  getChannel,
  requireChannelOwnership,
  async (req, res) => {
    let session;
    try {
      session = await mongoose.startSession();
      session.startTransaction();

      const channelDoc = req.channel; // available through getChannel middleware
      const allowedFields = ChannelModel.getOnUpdateBindAllowedFields();
      for (let fieldName in req?.body) {
        if (allowedFields.includes(fieldName)) {
          channelDoc[fieldName] = req?.body?.[fieldName];
        }
      }
      await channelDoc.save({session});

      // notify all members that channel is updated
      // is timestamp of the memberships updated? yes
      const result = await ChannelUserMembershipModel.updateMany(
        { channel_id: channelDoc?._id },
        { $set: { der_channelUpdatedAt: channelDoc?.updatedAt } },
        { session }
      );

      await session.commitTransaction();

      res.json({ data: { message: "Channel edited successfully" } });
    } catch (err) {
      await session.abortTransaction();

      const { status, errorData } = handleErrors(err, "channels");
      return res.status(status).json({ error: errorData });
    } finally {
      await session.endSession();
    }
  }
);

// create one channel
router.post("/", async (req, res) => {
  try {
    const channelBeforeSave = new ChannelModel();
    const allowedFields = ChannelModel.getOnCreateBindAllowedFields();
    for (let fieldName in req?.body) {
      if (allowedFields.includes(fieldName)) {
        channelBeforeSave[fieldName] = req?.body?.[fieldName];
      }
    }
    channelBeforeSave.owner_id = req.auth.user._id;
    const channelDoc = await channelBeforeSave.save();
    res.status(201).json({ data: channelDoc });
  } catch (err) {
    const { status, errorData } = handleErrors(err, "channels");
    return res.status(status).json({ error: errorData });
  }
});

// delete one channel
router.delete(
  "/:channelId",
  getChannel,
  requireChannelOwnership,
  async (req, res) => {
    let session;
    try {
      session = await mongoose.startSession();
      session.startTransaction();

      const channelDoc = req?.channel;

      await cascadeDeleteChannel(channelDoc, session);

      await session.commitTransaction();

      res.json({ data: { message: "Channel deleted successfully" } });
    } catch (err) {
      await session.abortTransaction();

      const { status, errorData } = handleErrors(err, "channels");
      return res.status(status).json({ error: errorData });
    } finally {
      await session.endSession();
    }
  }
);

// message routes

// get all meesages from one channel (by descending createdAt order)
// if cursor id is given in query parameters: get all messages before cursor id
// if limit is given in query parameters: get all meesages with limit value
// router.get("/:id/messages", getChannel, async (req, res) => {
//   try {
//     let messages = MessageModel.find({ channel_id: req.params.id });
//     if (req.query.cursor) {
//       messages = messages.where({ _id: { $lt: req.query.cursor } });
//     }
//     if (req.query.limit) {
//       messages = messages.limit(req.query.limit);
//     }
//     messages = await messages.sort({ createdAt: -1 });
//     res.send(messages);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// });

// creaet one message for one channel
// router.post("/:id/messages", getChannel, async (req, res) => {
//   const message = new MessageModel({
//     body: req.body.body,
//     channel_id: req.params.id,
//   });
//   try {
//     const newMessage = await message.save();
//     let io = req.app.get("socket_instance");
//     io.to(req.params.id).emit("new_message_from_server", newMessage);
//     res.status(201).json(newMessage);
//     // setTimeout(() => {
//     //     let io = req.app.get('socket_instance');
//     //     io.to(req.params.id).emit('new_message_from_server', newMessage);
//     //     // req.io.to(req.params.id).emit('new_message_from_server', newMessage);
//     //     res.status(201).json(newMessage)
//     // }, 5000); // TODO: remove timeout
//   } catch (err) {
//     res.status(400).json({ message: err.message });
//   }
// });

module.exports = router;
