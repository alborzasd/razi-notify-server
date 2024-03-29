// const mongoose = reuqire("mongoose");
const { systemRoleEnum } = require("../models/Constans");
const { model: ChannelModel } = require("../models/Channel");
const {
  model: ChannelUserMembershipModel,
} = require("../models/ChannelUserMembership");
const { isValidObjectId } = require("../routes/utilities");

// finds channel by _id
// if not valid object id
// finds channel by identifier
async function getChannel(req, res, next) {
  const channelId = req?.params?.channelId;
  const isObjectId = isValidObjectId(channelId);

  let channel;
  try {
    if (isObjectId) {
      channel = await ChannelModel.findById(channelId);
    } else {
      const channelIdentifierLowercase = channelId?.toString()?.toLowerCase();
      channel = await ChannelModel.findOne({
        identifier_lowercase: channelIdentifierLowercase,
      });
    }

    if (!channel) {
      return res.status(404).json({
        error: {
          message: `There is no channel with id: ${channelId}`,
          messagePersian: `کانالی با شناسه ${channelId} یافت نشد.`,
        },
      });
    }
  } catch (err) {
    return res.status(500).json({ error: { message: err.message } });
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

  if (!userId || !channelOwnerId || !userRole) {
    return res.status(500).json({
      error: {
        message: "Lack of necessary information to verify ownership",
        messagePersian: "کمبود اطلاعات لازم برای احراز مالکیت کانال",
      },
    });
  }

  if (userRole !== systemRoleEnum.root_admin) {
    if (userId !== channelOwnerId) {
      return res.status(403).json({
        error: {
          message: "Forbidden, you are not the owner of this channel",
          messagePersian: "عملیات غیر مجاز. این کانال متعلق به شما نیست",
        },
      });
    }
    // channel belongs to user
    return next(); // we should return otherwise the second 'next()' is called again ?
  }
  // user is root_admin
  return next();
};

// when a client calls api to get messages of a specific channel
// he must be member of that channel
// if successful, assigns membership row to req.membershipDoc
async function requireChannelMembership(req, res, next) {
  try {
    const channelDoc = req?.channel;
    const userDoc = req?.auth?.user;

    if (!channelDoc || !userDoc) {
      return res.status(500).json({
        error: {
          message: "Lack of necessary information to verify membership",
          messagePersian: "کمبود اطلاعات لازم برای احراز عضویت کانال",
        },
      });
    }

    const membershipDoc = await ChannelUserMembershipModel.findOne({
      user_id: userDoc?._id,
      channel_id: channelDoc?._id,
    });

    if (!membershipDoc) {
      return res.status(403).json({
        error: {
          message: "Forbidden, you are not member of this channel",
          messagePersian: "عملیات غیر مجاز. شما عضو این کانال نیستید.",
        },
      });
    }

    req.membershipDoc = membershipDoc;
    return next();
  } catch (err) {
    return res.status(500).json({ error: { message: err.message } });
  }
}

module.exports = {
  getChannel,
  requireChannelOwnership,
  requireChannelMembership,
};
