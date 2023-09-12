const express = require("express");

const {
  model: ChannelModel,
  collectionName: channelsCollectionName,
} = require("../models/Channel");

const {
  model: ChannelUserMembershipModel,
} = require("../models/ChannelUserMembership");

const { model: MessageModel } = require("../models/Message");

const {
  getChannel,
  requireChannelMembership,
} = require("../middlewares/channelMiddlewares");

const { isValidObjectId, handleErrors } = require("./utilities");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    // ?? may be it is more accurate to assign the time stamp before running any query to db
    // i.e. a user send user to sync channels
    // this route will trigger a query to find all joined channels
    // immediatelly after the query a new channel is created by an admin
    // so this request can not catch that new channel to send it to the user
    // if a define new lastSyncTimestamp to a time after that query
    // then, the next sync request also can not catch that new channel
    // but if we assign the newLastSyncTimestamp before any query
    // there is a chance to get duplicate result (same new channel twice)
    // but client can ignore duplicates
    const responseLastSync = new Date().toISOString();

    const requestLastSync = req?.query?.lastSyncTimestamp;
    // how many channels was user joined at the last sync time (i.e. 1 year ago)
    const requestMembershipCount = parseInt(req?.query?.membershipCount) || 0;
    const userDoc = req?.auth?.user;

    let channelsAdded = [];
    let channelsEdited = [];
    let existingChannelIdsToComapre = [];
    let isAnyMembershipDeleted = false;

    // let messagesAdded = [];

    // command client to replace new data with saved data
    let shouldResetCurrentData = false;
    if (!requestLastSync) {
      // get channels
      channelsAdded = await findAllJoinedChannes(userDoc?._id);
      // get last messages for each channel
      // const channelIds = channelsAdded.map((channel) => channel?._id);
      // messagesAdded = await findLastMessagesForChannelIds(channelIds);

      shouldResetCurrentData = true;
    } else {
      const newModifiedChannels = await findNewOrModifiedChannels(
        userDoc?._id,
        requestLastSync
      );

      for (let i = 0; i < newModifiedChannels?.length; i++) {
        const channel = newModifiedChannels[i];
        if (
          new Date(channel?.membershipCreatedAt) > new Date(requestLastSync)
        ) {
          channelsAdded.push(channel);
        } else {
          channelsEdited.push(channel);
        }
      }

      const channelsWithNewOrModifiedMessages =
        await findMembershipsWithNewOrModifiedMessages(
          userDoc?._id,
          requestLastSync
        );
      channelsEdited = channelsEdited.concat(channelsWithNewOrModifiedMessages);

      // to detect if any membership is deleted or not
      // we get current count of memberships from client
      // and add it with new created memberships
      // we call it maximumCount
      // the maximum number of membership rows in db is equal to maximumCount
      // if it's less than totalCount, we can say that 1 or more membership is deleted
      // with this approach we also can detect deleteion of a channel
      // because when a channel is deleted
      // all of corresponding membership rows will be deleted in a transaction
      const currentMembershipcount = await getCurrentMembershipCount(
        userDoc?._id
      );
      const maximumCount = requestMembershipCount + channelsAdded?.length;
      isAnyMembershipDeleted = !(currentMembershipcount === maximumCount);

      if (isAnyMembershipDeleted) {
        existingChannelIdsToComapre = await findAllJoinedChannelIds(
          userDoc?._id
        );
      }

      // TODO: remove log
      // console.log("");
      // console.log("");
      // console.log("request last sync", new Date(requestLastSync));
      // console.log("now", new Date());
      // console.log("new modified", newModifiedChannels);
      // console.log("added", channelsAdded);
      // console.log("edited", channelsEdited);
      // console.log(
      //   "currentCount",
      //   currentMembershipcount,
      //   "maximum",
      //   maximumCount
      // );
      // console.log("isAnyDeleted", isAnyMembershipDeleted);
      // console.log("existing ids", existingChannelIdsToComapre);
      // console.log("channels with new message", channelsWithNewOrModifiedMessages);
    }

    // TODO: remove log
    // console.log('last messages', addedMessages?.length, addedMessages);

    res.json({
      data: {
        lastSyncTimestamp: responseLastSync,
        shouldResetCurrentData,
        channels: {
          added: channelsAdded,
          edited: channelsEdited,
          existingIds: existingChannelIdsToComapre,
          isAnyMembershipDeleted,
        },
        messages: {
          // added: messagesAdded,
          added: [],
          edited: [],
          removed: [],
        },
      },
    });
  } catch (err) {
    const { status, errorData } = handleErrors(err);
    return res.status(status).json({ error: errorData });
  }
});

/**
 *  sync messages of specific channelId
 * get query params as
 * after: "first" => return {n} messages from first message, first message included
 * before: "last" => return {n} messages from last message, last message included
 * after: messageId => return {n} messages after messageId, but not messageId itself
 * before: messageId => return {n} messages before messageId, but not messageId itself
 * the {n} value is configured by server
 * if 'after' and 'before' keys are both provided
 * the 'after' key will be processed
 * https://domain.com/sync/channelId?after=messageId
 */
router.get(
  "/:channelId",
  getChannel,
  requireChannelMembership,
  async (req, res) => {
    try {
      const limit = 10;
      const channelDoc = req?.channel;

      const afterValue = req?.query?.after;
      const beforeValue = req?.query?.before;

      let $match = { channel_id: channelDoc?._id };
      let $sort = { createdAt: 1 };
      if (afterValue === "first") {
        // no need to change filter and sort properties
      } else if (isValidObjectId(afterValue)) {
        const messageId = afterValue;
        $match = { ...$match, _id: { $gt: messageId } };
      } else if (beforeValue === "last") {
        $sort = { createdAt: -1 };
      } else if (isValidObjectId(beforeValue)) {
        const messageId = beforeValue;
        $match = { ...$match, _id: { $lt: messageId } };
        $sort = { createdAt: -1 };
      } else {
        return res
          .status(400)
          .json({ error: { message: "invalid query parameters" } });
      }

      const result = await MessageModel.find($match)
        .sort($sort)
        .limit(limit)
        .lean();

      // TODO: remove delay
      // await new Promise(res => setTimeout(res, 3000));

      // we send the limit number to response
      // so client knows if the count of messages is less than limit
      // (0-9 for limit 10)
      // then there is no more items to fetch
      return res.json({ data: { messages: result, limit } });
    } catch (err) {
      const { status, errorData } = handleErrors(err);
      return res.status(status).json({ error: errorData });
    }
  }
);

/*
 * client sends the id of last message read
 * if last message read comes from server, we call it lastMessageRead
 * if last message read comes from client to server, we call it lastMessageVisited
 */
router.patch(
  "/:channelId/lastMessageVisited",
  getChannel,
  requireChannelMembership,
  async (req, res) => {
    try {
      const membershipDoc = req?.membershipDoc;
      const lastMessageVisitedId = req?.body?.messageId;
      const messageDoc = await MessageModel.findById(lastMessageVisitedId);

      if (!messageDoc) {
        return res.json({ data: { message: "messageId does not exist" } });
      }

      const numUnreadMessagesToSave = await MessageModel.countDocuments({
        _id: { $gt: messageDoc?._id },
        channel_id: membershipDoc?.channel_id,
      });

      // update membership row
      // only if messageDoc.createdAt is newer than der_lastMessageRead.createdAt
      const lastMessageVisitedDate = new Date(messageDoc?.createdAt);
      const lastMessageReadDate = new Date(
        membershipDoc?.der_lastMessageRead?.createdAt
      );
      // if last visited message(sent from client)
      // is newer than last message read (stored in membership row)
      // or lastMessageRead is not stored in db
      if (
        isNaN(lastMessageReadDate) ||
        lastMessageVisitedDate > lastMessageReadDate
      ) {
        membershipDoc.der_lastMessageRead = messageDoc;
        membershipDoc.der_numUnreadMessages = numUnreadMessagesToSave;
        await membershipDoc.save();
      }

      // TODO: remove log
      // console.log('membershipDoc', membershipDoc);
      // console.log('lastMessageVisitedId', lastMessageVisitedId);
      // console.log('messageDoc', messageDoc?.title);
      // console.log('numUnreadMessagesToSave', numUnreadMessagesToSave);

      return res.json({
        data: { message: "Last message visited updated successfully" },
      });
    } catch (err) {
      // TODO: remove log
      // console.log('err', err);

      const { status, errorData } = handleErrors(err);
      return res.status(status).json({ error: errorData });
    }
  }
);

// channel queries

async function findAllJoinedChannes(user_id) {
  const result = await ChannelUserMembershipModel.aggregate([
    generateStageForPrematchChannels(user_id, undefined),
    ...generateStageForLookupChannels(),
  ]);

  return result;
}

async function findAllJoinedChannelIds(user_id) {
  const result = await ChannelUserMembershipModel.aggregate([
    generateStageForPrematchChannels(user_id, undefined),
    {
      $project: {
        _id: "$channel_id",
      },
    },
  ]);

  return result;
}

// the 'new channels' does not mean channels created after that timestamp
// it means channels that user has been joined after that timestamp
// channel can be created 100 years ago
async function findNewOrModifiedChannels(user_id, timestamp) {
  const result = await ChannelUserMembershipModel.aggregate([
    generateStageForPrematchChannels(user_id, timestamp),
    ...generateStageForLookupChannels(),
  ]);

  return result;
}

/** returns how many channels is user joined currently */
async function getCurrentMembershipCount(user_id) {
  return await ChannelUserMembershipModel.countDocuments({ user_id });
}

/**
 * returns membership rows that messageCollectionUpdatedAt field
 * has new date value
 *
 * the result will be added to channelsEdited array in response
 * so channelsEdited array can have new modified channels
 * and some changed/unchanged channels that messages of them has changed recently
 *
 * so it may have duplicate rows of channel_ids
 * for example a channel title is changed and also a new message is added
 *
 * at the end we convert the channel_id of membership rows to _id
 * so it will be like a channel document row
 *
 * may be lastMessageRead and numUnreadMessages is updated by client
 * so we need to send the new date
 */
async function findMembershipsWithNewOrModifiedMessages(user_id, timestamp) {
  const result = await ChannelUserMembershipModel.aggregate([
    ...generateStagesForMembershipsWithNewOrModifiedMessages(
      user_id,
      timestamp
    ),
  ]);

  return result;
}

// message queries

// async function findLastMessagesForChannelIds(channelIds) {
//   const result = await MessageModel.aggregate([
//     ...generateStagesForFindLastMessages(channelIds),
//   ]);

//   return result;
// }

// stage gneration helpers
// we separate queries and stages
// so we can use 1 stage at multiple aggregation queries

/** lookup and extract info of channels */
function generateStageForLookupChannels() {
  return [
    {
      $lookup: {
        from: channelsCollectionName,
        localField: "channel_id",
        foreignField: "_id",
        as: "channel",
      },
    },
    // channel fields contains array (1 element)
    // extract first result and override 'channels' field
    {
      $addFields: {
        channel: { $first: "$channel" },
      },
    },
    // destructure nested channel field
    // we don't need the member ship fields (_id, user_id, ...)
    {
      $project: {
        _id: "$channel._id",
        // id: "$channel._id",
        identifier: "$channel.identifier",
        title: "$channel.title",
        description: "$channel.description",
        createdAt: "$channel.createdAt",
        updatedAt: "$channel.updatedAt",
        // membership fields that we want to keep
        membershipCreatedAt: "$createdAt",
        der_lastMessage: "$der_lastMessage",
        der_numUnreadMessages: "$der_numUnreadMessages",
        der_lastMessageRead: "$der_lastMessageRead",
      },
    },
  ];
}

/**
 * generate $match stage to filter membership items by user_id
 * if timestamp is given, add date filter to the $match options
 * the timestamp is for filter channels that user is joined after that time
 * and also filter joined channels that updated after that time
 * the generated stage will only returns membership rows that need lookup
 * so every time user sends /sync request
 * the lookup does not run on all the channel_ids
 *
 * if user has been joined to a channel after the timestamp
 * regardless the time that channel is created (100 years ago)
 * it can be found by filtering createdAt date
 *
 * if one of joined channels has been edited (title, identifier, ...)
 * then in a transaction, all membership rows of the corresponding channel
 * is updated by asigning new date to 'der_ChannelUpdatedAt'
 * so it can be found by that field
 *
 * in one $match stage, we can get new channels or modified channels
 */
function generateStageForPrematchChannels(user_id, timestamp) {
  if (!timestamp) {
    return { $match: { user_id } };
  }
  return {
    $match: {
      user_id,
      $or: [
        { createdAt: { $gt: new Date(timestamp) } },
        { der_channelUpdatedAt: { $gt: new Date(timestamp) } },
      ],
    },
  };
}

/**
 * the function name is 3km
 */
function generateStagesForMembershipsWithNewOrModifiedMessages(
  user_id,
  timestamp
) {
  return [
    {
      $match: {
        user_id,
        $or: [
          { der_messageCollectionUpdatedAt: { $gt: new Date(timestamp) } },
          // may be lastMessageRead and numUnreadMessages is updated by client
          // so we need to send the new date
          { updatedAt: { $gt: new Date(timestamp) } },
        ],
      },
    },
    {
      $project: {
        _id: "$channel_id",
        der_lastMessage: 1,
        der_lastMessageRead: 1,
        der_numUnreadMessages: 1,
      },
    },
  ];
}

/**
 * returns last message of each channelId
 */
// function generateStagesForFindLastMessages(channelIds) {
//   return [
//     { $match: { channel_id: { $in: channelIds } } },
//     {
//       $sort: {
//         channel_id: 1,
//         createdAt: -1,
//       },
//     },
//     {
//       $group: {
//         _id: "$channel_id",
//         lastMessage: { $first: "$$ROOT" },
//       },
//     },
//     {
//       $replaceRoot: { newRoot: "$lastMessage" },
//     },
//   ];
// }

module.exports = router;
