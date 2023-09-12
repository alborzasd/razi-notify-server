const express = require("express");
const mongoose = require("mongoose");
const {
  model: ChannelUserMembershipModel,
} = require("../models/ChannelUserMembership");
const { model: UserModel } = require("../models/User");
const { model: MessageModel } = require("../models/Message");

const {
  // getChannel,
  requireChannelOwnership,
} = require("../middlewares/channelMiddlewares");

const { getMessage } = require("../middlewares/messageMiddlewares");

const { handleErrors, getMemberPhoneNumbers } = require("./utilities");

const { sendSmsToPhoneNumberList } = require("../sms/smsManager");

const router = express.Router();

// get messages of a channel
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

  const $preMatch = {
    channel_id: channelDoc._id,
  };

  if (searchValue) {
    if (searchField === "title") {
      $preMatch.title = { $regex: searchValue, $options: "i" }; // 'i': case insensitive
    } else if (searchField === "body") {
      $preMatch.body = { $regex: searchValue, $options: "i" };
    }
  }

  try {
    const result = await MessageModel.aggregate([
      { $match: $preMatch },
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
        channel: channelDoc,
      },
    });
  } catch (err) {
    res.status(500).json({ error: { message: err?.message } });
  }
});

// get one message of a channel
router.get("/:messageId", getMessage, async (req, res) => {
  // return res.json(req?.messagelDoc);
  try {
    const messageDoc = req?.messageDoc;
    // populate channel name
    await messageDoc.populate("channel", "title owner_id identifier");
    // populate sender name
    if (messageDoc?.sent_by_user_id) {
      // populate if sender user is different than channel owner
      await messageDoc.populate(
        "sent_by_user",
        "username first_name last_name"
      );
    } else {
      messageDoc.sent_by_user = await UserModel.findById(
        messageDoc?.channel?.owner_id,
        {
          username: 1,
          first_name: 1,
          last_name: 1,
        }
      );
    }

    return res.json({ data: messageDoc });
  } catch (err) {
    const { status, errorData } = handleErrors(err);
    return res.status(status).json({ error: errorData });
  }
});

router.post("/", requireChannelOwnership, async (req, res) => {
  let session;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const channelDoc = req?.channel;

    const messageBeforeSave = new MessageModel();
    const allowedFields = MessageModel.getOnBindAllowedFields("create");

    for (let fieldName in req?.body) {
      if (allowedFields.includes(fieldName)) {
        messageBeforeSave[fieldName] = req?.body?.[fieldName];
      }
    }
    messageBeforeSave.channel_id = channelDoc?._id;
    // TODO: what if the message is sent by agent, not owner

    // if smsEnabled send sms and if fails
    // throw error and do not create new message in db
    if (req?.body?.smsEnabled) {
      const phoneNumberList = await getMemberPhoneNumbers(channelDoc._id);
      const messageText =
        "https://razi-notify.ir" +
        "\n\n" +
        `کانال ${channelDoc?.title}` +
        "\n\n" +
        req?.body?.title +
        "\n" +
        req?.body?.der_bodyRaw;
      await sendSmsToPhoneNumberList(phoneNumberList, messageText);
    }

    const messageDoc = await messageBeforeSave.save({ session });

    const result = await ChannelUserMembershipModel.updateMany(
      { channel_id: channelDoc?._id },
      {
        $set: {
          der_lastMessage: messageDoc,
          der_messageCollectionUpdatedAt: new Date(),
        },
        $inc: { der_numUnreadMessages: 1 },
      },
      { session }
    );

    await session.commitTransaction();

    return res.status(201).json({ data: messageDoc });
  } catch (err) {
    await session.abortTransaction();

    const { status, errorData } = handleErrors(err);
    return res.status(status).json({ error: errorData });
  } finally {
    await session.endSession();
  }
});

router.patch(
  "/:messageId",
  getMessage,
  requireChannelOwnership,
  async (req, res) => {
    let session;
    try {
      session = await mongoose.startSession();
      session.startTransaction();

      const messageDoc = req?.messageDoc;
      const channelDoc = req?.channel;
      const allowedFields = MessageModel.getOnBindAllowedFields("update");
      for (let fieldName in req?.body) {
        if (allowedFields.includes(fieldName)) {
          messageDoc[fieldName] = req?.body?.[fieldName];
        }
      }

      // if smsEnabled send sms and if fails
      // throw error and do not edit message in db
      if (req?.body?.smsEnabled) {
        const phoneNumberList = await getMemberPhoneNumbers(channelDoc._id);
        const messageText =
          "https://razi-notify.ir" +
          "\n\n" +
          `کانال ${channelDoc?.title}` +
          "\n\n" +
          req?.body?.title +
          " [ویرایش]" +
          "\n" +
          req?.body?.der_bodyRaw;
        await sendSmsToPhoneNumberList(phoneNumberList, messageText);
      }

      await messageDoc.save({ session });

      // get the last message of the channel (may be same as messageDoc or not)
      // to assign to each membership row
      const lastMessage = (
        await MessageModel.find({ channel_id: channelDoc?._id })
          .session(session)
          .sort({ createdAt: -1 })
          .limit(1)
          .lean()
      )?.[0]; // (await find lean) returns array

      // notify members that a message is updated
      const result = await ChannelUserMembershipModel.updateMany(
        { channel_id: channelDoc?._id },
        {
          $set: {
            der_messageCollectionUpdatedAt: messageDoc?.updatedAt,
            der_lastMessage: lastMessage,
          },
        },
        { session }
      );

      // find the membership rows
      // that the _id of lastMessageRead is equal to
      // current modified messageDoc
      // and assign the modified message to lastMessageRead
      // TODO: test
      const result2 = await ChannelUserMembershipModel.updateMany(
        { channel_id: channelDoc?._id, "der_lastMessageRead._id": messageDoc?._id },
        {
          $set: {
            der_lastMessageRead: messageDoc,
          },
        },
        { session }
      );

      await session.commitTransaction();

      res.json({ data: { message: "Message edited successfully" } });
    } catch (err) {
      await session.abortTransaction();

      const { status, errorData } = handleErrors(err);
      return res.status(status).json({ error: errorData });
    } finally {
      await session.endSession();
    }
  }
);

router.delete(
  "/:messageId",
  getMessage,
  requireChannelOwnership,
  async (req, res) => {
    let session;
    try {
      session = await mongoose.startSession();
      session.startTransaction();

      const messageDoc = req?.messageDoc;
      const channelDoc = req?.channel;
      const deletedMessageCreatedAt = messageDoc?.createdAt;

      await MessageModel.deleteOne({ _id: messageDoc?._id }, { session });
      // deprecated ?
      // await messageDoc.remove();

      // get the last message of the channel (the messageDoc might be last message or not)
      // to assign to each membership row
      const lastMessage = (
        await MessageModel.find({ channel_id: channelDoc?._id })
          .session(session)
          .sort({ createdAt: -1 })
          .limit(1)
          .lean()
      )?.[0]; // (await find lean) returns array

      // notify all members that a message deleted
      const result1 = await ChannelUserMembershipModel.updateMany(
        { channel_id: channelDoc?._id },
        {
          $set: {
            der_lastMessage: lastMessage || null,
            der_messageCollectionUpdatedAt: new Date(),
          },
        },
        { session }
      );

      // for each member
      // decrement numUnreadMessages
      // if deleted message was created after lastMessageRead
      // or if lastMessageRead does not exist (is null)
      // the last condition happens when a user joins to a channel that has no message
      // and never navigated to that channel
      const result2 = await ChannelUserMembershipModel.updateMany(
        {
          channel_id: channelDoc?._id,
          $or: [
            {
              "der_lastMessageRead.createdAt": {
                $lt: deletedMessageCreatedAt,
              },
            },
            {
              der_lastMessageRead: null,
            },
          ],
        },
        {
          $inc: { der_numUnreadMessages: -1 },
        },
        { session }
      );
      // why we trigger 2 update queries on the same collection ?
      // because mongodb does not support conditional update fields (use $cond in $set)

      // one message before the deleted message
      // TODO: test
      const messageBeforeDeleted = (
        await MessageModel.find({
          channel_id: channelDoc?._id,
          _id: { $lt: messageDoc?._id },
        })
          .session(session)
          .sort({ createdAt: -1 })
          .limit(1)
          .lean()
      )?.[0]; // (await find lean) returns array

      // find membership rows
      // the the _id of lastMessageRead
      // is equal to _id of deleted message
      // and assign the message before the deleted message
      // to lastMessageRead
      // this operation should be done
      // after updating numUnreadMessages
      //
      // otherwise the num will decrease if the deleted message
      // is same as the lastMessageRead (but we know it's read and should not be counted)
      // TODO: test
      const result3 = await ChannelUserMembershipModel.updateMany(
        {
          channel_id: channelDoc?._id,
          "der_lastMessageRead._id": messageDoc?._id,
        },
        {
          $set: {
            der_lastMessageRead: messageBeforeDeleted || null,
          },
        },
        { session }
      );

      await session.commitTransaction();

      res.json({ data: { message: "Message removed successfully" } });
    } catch (err) {
      await session.abortTransaction();

      const { status, errorData } = handleErrors(err);
      return res.status(status).json({ error: errorData });
    } finally {
      await session.endSession();
    }
  }
);

module.exports = router;
