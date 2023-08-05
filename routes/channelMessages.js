const express = require("express");
const { model: ChannelModel } = require("../models/Channel");
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
    await messageDoc.populate("channel", "title owner_id");
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

    return res.json({data: messageDoc});
  } catch (err) {
    const { status, errorData } = handleErrors(err);
    return res.status(status).json({ error: errorData });
  }
});

router.post("/", requireChannelOwnership, async (req, res) => {
  try {
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
        req?.body?.body;
      await sendSmsToPhoneNumberList(phoneNumberList, messageText);
    }

    const messageDoc = await messageBeforeSave.save();

    return res.status(201).json({ data: messageDoc });
  } catch (err) {
    const { status, errorData } = handleErrors(err);
    return res.status(status).json({ error: errorData });
  }
});

module.exports = router;
