const express = require("express");
const { model: UserModel } = require("../models/User");
const {
  collectionName: departmentCollectionName,
} = require("../models/Department");
const router = express.Router();
const mongoose = require("mongoose");
const {
  handleErrors,
  generateUserAggregationStages,
  cascadeDeleteManyUsers,
} = require("./utilities");

const { requireRole } = require("../middlewares/roleMiddlewares");

const Constants = require("../models/Constans");

// get all users, can set filter and pagination
// returns items(entities) with pagination result(meta: totalCount)
router.get("/", async (req, res) => {
  const searchField = req.query.searchField || null;
  const searchValue = req.query.searchValue || null;

  let pageNum = parseInt(req.query.pageNum);
  pageNum = !isNaN(pageNum) && pageNum > 0 ? pageNum : 1;

  // if pageSize in query was 0 or any value that is parsed to NaN
  // set pageSize to 10
  let pageSize = parseInt(req.query.pageSize);
  pageSize = !isNaN(pageSize) && pageSize > 0 ? pageSize : 10;

  const $preMatch = {};

  if (searchValue) {
    if (searchField === "username") {
      $preMatch.username = { $regex: searchValue, $options: "i" };
    } else if (searchField === "fullname") {
      $preMatch.$or = [
        { first_name: { $regex: searchValue, $options: "i" } },
        { last_name: { $regex: searchValue, $options: "i" } },
      ];
    } else if (searchField === "system_role") {
      $preMatch.system_role = searchValue; // exact match
    } else if (searchField === "student_position") {
      $preMatch.student_position = searchValue;
    } else if (searchField === "lecturer_position") {
      $preMatch.lecturer_position = searchValue;
    } else if (searchField === "employee_position") {
      $preMatch.employee_position = { $regex: searchValue, $options: "i" };
    } else if (searchField === "department_id") {
      $preMatch.department_id = mongoose.Types.ObjectId(searchValue);
    }
  }

  try {
    const result = await UserModel.aggregate(
      generateUserAggregationStages($preMatch, pageNum, pageSize)
    );

    const entities = result[0]?.entities || [];
    const totalCount = result[0]?.count[0]?.totalCount || 0;

    res.json({
      data: {
        entities,
        meta: {
          pageNum,
          pageSize,
          totalCount,
        },
        // client will use these dictionaries to translate fields of entities
        systemRoleEnumPersian: Constants.systemRoleEnumPersian,
        studentPositionEnumPersian: Constants.studentPositionEnumPersian,
        lecturerPositionEnumPersian: Constants.lecturerPositionEnumPersian,
      },
    });
  } catch (err) {
    const { status, errorData } = handleErrors(err, "users");
    return res.status(status).json({ error: errorData });
  }
});

// find users with exact usernames
// it's a post request by used to filter users
// it receivces large amount of usernames
// so it need to be sent as request body (not url route and query params)
router.post("/findByUsernames", async (req, res) => {
  try {
    // if not converted to string
    // the usernames treated as number so mongo aggregation will not
    // match to the string username in documents
    // but mongoose.find will cast to string automatically
    const usernames = req?.body?.usernames
      ? req?.body?.usernames?.map((username) => username.toString())
      : [];
    const $preMatch = { username: { $in: usernames } };

    // const result = await UserModel.find({username: {$in: usernames}});
    const result = await UserModel.aggregate(
      generateUserAggregationStages($preMatch, 1, 0)
    );

    const entities = result[0]?.entities || [];
    const totalCount = result[0]?.count[0]?.totalCount || 0;

    res.json({
      data: {
        entities,
        meta: {
          // pageNum,
          // pageSize,
          totalCount,
        },
        // client will use these dictionaries to translate fields of entities
        systemRoleEnumPersian: Constants.systemRoleEnumPersian,
        studentPositionEnumPersian: Constants.studentPositionEnumPersian,
        lecturerPositionEnumPersian: Constants.lecturerPositionEnumPersian,
      },
    });
  } catch (err) {
    const { status, errorData } = handleErrors(err, "users");
    return res.status(status).json({ error: errorData });
  }
});

router.post(
  "/addMany",
  requireRole([Constants.systemRoleEnum.root_admin]),
  async (req, res) => {
    let session;
    try {
      session = await mongoose.startSession();
      session.startTransaction();

      const requestUsers = req?.body?.users || [];
      const requestUsernames = requestUsers.map((user) =>
        user?.username?.toString()
      );

      const existingUsers = await UserModel.find({
        username: { $in: requestUsernames },
      });

      const existingUsernames = existingUsers.map((user) =>
        user?.username?.toString()
      );

      const newUsers = requestUsers.filter(
        (reqUser) => !existingUsernames.includes(reqUser?.username?.toString())
      );

      await UserModel.create(newUsers, { session });
      // does not run pre save middleware for each user doc
      // await UserModel.insertMany(newUsers, { session });

      await session.commitTransaction();

      return res.json({
        data: {
          entities: newUsers,
        },
      });
    } catch (err) {
      await session.abortTransaction();

      const { status, errorData } = handleErrors(err, "users");
      return res.status(status).json({ error: errorData });
    } finally {
      await session.endSession();
    }
  }
);

router.patch(
  "/editMany",
  requireRole([Constants.systemRoleEnum.root_admin]),
  async (req, res) => {
    let session;
    try {
      session = await mongoose.startSession();
      session.startTransaction();

      const requestUsers = req?.body?.users || [];

      const editedUsers = [];

      // const userDoc = await UserModel.findOne(
      //   {
      //     username: requestUsers[0]?.username.toString(),
      //   },
      //   { session }
      // );

      for (let i = 0; i < requestUsers.length; i++) {
        const requestUser = requestUsers[i];

        // username is different from _id
        // we can't use findById(returns doc or null)
        const userDoc = await UserModel.findOne({
          username: requestUser?.username.toString(),
        });

        if (userDoc) {
          // username
          if (requestUser?.new_username) {
            userDoc.username = requestUser?.new_username;
          }

          // password
          if (requestUser?.password) {
            userDoc.password = requestUser?.password;
          }

          // first_name
          if (requestUser?.first_name) {
            userDoc.first_name = requestUser?.first_name;
          }

          // last_name
          if (requestUser?.last_name) {
            userDoc.last_name = requestUser?.last_name;
          }

          // system_role
          if (
            // if value sent from client (only root_admin can send this request)
            // for this row of user is 'user' or 'channel_admin'
            // and also the corresponding username sent is not root_admin
            // then system_role of that user can be edited
            // it means system_role can be changed from 'user' to 'channel_admin'
            // or vice versa
            // but system_role of root_admin can not be changed
            [
              Constants.systemRoleEnum.user,
              Constants.systemRoleEnum.channel_admin,
            ].includes(requestUser?.system_role) &&
            userDoc?.system_role !== Constants.systemRoleEnum.root_admin
          ) {
            userDoc.system_role = requestUser?.system_role;
          }

          // student_position
          if (parseInt(requestUser?.student_position) === 0) {
            userDoc.student_position = undefined; // unset
          } else if (requestUser?.student_position) {
            userDoc.student_position = requestUser?.student_position;
          }

          // lecturer_position
          if (parseInt(requestUser?.lecturer_position) === 0) {
            userDoc.lecturer_position = undefined; // unset
          } else if (requestUser?.lecturer_position) {
            userDoc.lecturer_position = requestUser?.lecturer_position;
          }

          // employee_position
          if (parseInt(requestUser?.employee_position) === 0) {
            userDoc.employee_position = undefined; // unset
          } else if (requestUser?.employee_position) {
            userDoc.employee_position = requestUser?.employee_position;
          }

          // description
          if (parseInt(requestUser?.description) === 0) {
            userDoc.description = undefined; // unset
          } else if (requestUser?.description) {
            userDoc.description = requestUser?.description;
          }

          // phone_number
          if (parseInt(requestUser?.phone_number) === 0) {
            userDoc.phone_number = undefined; // unset
          } else if (requestUser?.phone_number) {
            userDoc.phone_number = requestUser?.phone_number;
          }

          // email
          if (parseInt(requestUser?.email) === 0) {
            userDoc.email = undefined; // unset
          } else if (requestUser?.email) {
            userDoc.email = requestUser?.email;
          }

          // departmnet_id
          if (
            requestUser?.department_id.toString() !==
            userDoc?.department_id.toString()
          ) {
            // console.log("department id different");
            userDoc.department_id = requestUser?.department_id;
          }

          editedUsers.push(userDoc);
          await userDoc.save({ session });
        }
      }

      await session.commitTransaction();

      return res.json({
        data: {
          entities: editedUsers,
        },
      });
    } catch (err) {
      await session.abortTransaction();

      const { status, errorData } = handleErrors(err, "users");
      return res.status(status).json({ error: errorData });
    } finally {
      await session.endSession();
    }
  }
);

router.delete(
  "/deleteMany",
  requireRole([Constants.systemRoleEnum.root_admin]),
  async (req, res) => {
    let session;
    try {
      session = await mongoose.startSession();
      session.startTransaction();

      const requestUsernames = req?.body?.usernames?.map((username) =>
        username.toString()
      );

      // only root admin can send this request
      // so req.user is the root admin itself
      const rootAdminUsername = req?.auth?.user?.username;
      
      const deletedUsers = await cascadeDeleteManyUsers(
        rootAdminUsername,
        requestUsernames,
        session
      );

      await session.commitTransaction();

      return res.json({
        data: {
          entities: deletedUsers,
        },
      });
    } catch (err) {
      await session.abortTransaction();

      const { status, errorData } = handleErrors(err, "users");
      return res.status(status).json({ error: errorData });
    } finally {
      await session.endSession();
    }
  }
);

module.exports = router;
