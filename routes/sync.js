const express = require('express');
const {model: ChannelModel} = require('../models/Channel');
const {model: MessageModel} = require('../models/Message');

const router = express.Router();

router.get('/', async (req, res) => {
  // ?? may be it is more accurate to assign the time stamp before running any query to db
  const lastSyncTimestamp = new Date().toISOString();
  console.log(req.query.lastSyncTimestamp);

  const channels = await ChannelModel.find();

  res.json({
    data: {
      lastSyncTimestamp,
      channels: {
        added: channels,
        edited: [],
        removed: []
      }, 
      messages: {
        added: [],
        edited: [],
        removed: []
      }
    }
  });
});

module.exports = router;