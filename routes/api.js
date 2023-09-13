/**
 * define all the api routes with /api prefix
 * so frontend static build can be accessed from root path
 */
const express = require('express');
const apiRouter = express.Router();

const { requireAuth } = require("../middlewares/authMiddleware");
const { requireRole } = require("../middlewares/roleMiddlewares");
const { getChannel } = require("../middlewares/channelMiddlewares");
const { systemRoleEnum } = require("../models/Constans");

apiRouter.use("/auth", require("./auth"));
apiRouter.use(
  "/users",
  requireAuth,
  requireRole([systemRoleEnum.root_admin, systemRoleEnum.channel_admin]),
  require("./users")
);
apiRouter.use(
  "/channels",
  requireAuth,
  requireRole([systemRoleEnum.root_admin, systemRoleEnum.channel_admin]),
  require("./channels")
);
apiRouter.use(
  "/channels/:channelId/messages",
  requireAuth,
  requireRole([systemRoleEnum.root_admin, systemRoleEnum.channel_admin]),
  // finds channel with req.params.channelId, assigns it to req.channel
  getChannel,
  require("./channelMessages")
);
apiRouter.use(
  "/channels/:channelId/members",
  requireAuth,
  requireRole([systemRoleEnum.root_admin, systemRoleEnum.channel_admin]),
  // finds channel with req.params.channelId, assigns it to req.channel
  getChannel,
  require("./channelMembers")
);
apiRouter.use(
  "/departments",
  requireAuth,
  requireRole([systemRoleEnum.root_admin, systemRoleEnum.channel_admin]),
  require("./departments")
);
apiRouter.use("/sync", requireAuth, require("./sync"));
apiRouter.use("/constants", require("./constants"));

module.exports = apiRouter;