const express = require('express');
const {model: ChannelModel} = require('../models/Channel');
const {model: MessageModel} = require('../models/Message');

const {
  // getChannel,
  requireChannelOwnership
} = require('../middlewares/channelMiddlewares');

const handleErrors = require('./utilities');

const router = express.Router();

// get messages of a channel
router.get('/', async (req, res) => {
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
    channel_id: channelDoc._id
  };

  if(searchValue) {
    if(searchField === "title") {
      $preMatch.title = { $regex: searchValue, $options: "i" }; // 'i': case insensitive
    } else if (searchField === "body") {
      $preMatch.body = { $regex: searchValue, $options: "i" };
    }
  }

  try {
    const result = await MessageModel.aggregate([
      {$match: $preMatch},
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
        channel: channelDoc
      },
    });
  }
  catch(err) {
    res.status(500).json({ error: { message: err?.message } });
  }
});

module.exports = router;