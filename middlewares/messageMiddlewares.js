const {model: MessageModel} = require('../models/Message');

const { isValidObjectId } = require("../routes/utilities");

async function getMessage(req, res, next) {
  try {
    const messageId = req?.params?.messageId;
    
    const errorData = {
      message: `There is no message with id: ${messageId}`,
      messagePersian: `پیامی با شناسه  ${messageId} یافت نشد.`
    };

    if(!isValidObjectId(messageId)) {
      return res.status(404).json({
        error: errorData
      });
    }

    // if we remove condition above
    // the invalid object id throws error and returns status 500 to client
    // but we want to return 404
    const messageDoc = await MessageModel.findById(messageId);

    if(!messageDoc) {
      return res.status(404).json({
        error: errorData
      });
    }
    
    req.messageDoc = messageDoc;
    return next();
  } catch (err) {
    return res.status(500).json({ error: { message: err.message } });
  }
}

module.exports = {
  getMessage,
}