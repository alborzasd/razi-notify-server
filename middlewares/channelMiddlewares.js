const {systemRoleEnum} = require('../models/Constans');
const { model: ChannelModel } = require("../models/Channel");

async function getChannel(req, res, next) {
  let channel;
  try {
    channel = await ChannelModel.findById(req.params.channelId);
    if (!channel) {
      return res
        .status(404)
        .json({error: { message: `There is no channel with id: ${req.params.channelId}` }});
    }
  } catch (err) {
    return res.status(500).json({error: { message: err.message }});
  }

  req.channel = channel;
  next();
}

// This middleware calls next() if the channel id blongs to the user that sends request
// otherwise returns 403 response
// if user is root_admin, this middleware walays returns true (next)
// useful for edit and delete operations of a channel
const requireChannelOwnership = (req, res, next) => {
  const userId = req?.auth?.user?._id?.toString();
  const userRole = req?.auth?.user?.system_role;
  const channelOwnerId = req?.channel?.owner_id?.toString();

  if(!userId || !channelOwnerId || !userRole) {
    return res.status(500).json({
      error: {
        message: 'Lack of necessary information to verify ownership',
        messagePersian: 'کمبود اطلاعات لازم برای احراز مالکیت کانال',
      }
    });
  }
  
  if(userRole !== systemRoleEnum.root_admin) {
    if(userId !== channelOwnerId) {
      return res.status(500).json({
        error: {
          message: 'Forbidden, you are not the owner of this channel',
          messagePersian: 'عملیات غیر مجاز. این کانال متعلق به شما نیست',
        }
      });
    }
    // channel belongs to user
    return next(); // we should return otherwise the second 'next()' is called again ?
  }
  // user is root_admin
  return next();
}

module.exports = {
  getChannel,
  requireChannelOwnership,
}