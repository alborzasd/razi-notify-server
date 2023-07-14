const express = require("express");
const { model: UserModel } = require("../models/User");
const {
  collectionName: departmentCollectionName,
} = require("../models/Department");
const router = express.Router();
const mongoose = require("mongoose");
const { handleErrors, generateUserAggregationStages } = require("./utilities");

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

// // takes err from catch(err)
// const handleErrors = (err) => {
//     // console.log(Object.getOwnPropertyNames(err), err.code);
//     console.log(err, Object.keys(err));
//     let errors = {};
//     // for(let property in UserModel.schema.paths){
//     //     errors[property] = ''
//     // }

//     if(err.code === 11000) { // TODO: what about other unique properties?
//         // console.log(Object.keys(err.keyValue));
//         const repetitivePropertyName = Object.keys((err.keyValue))[0];
//         const message = `این مقدار قبلا ثبت شده و نمیتواند تکراری باشد.`;
//         errors[repetitivePropertyName] = message;
//         return errors;
//     }
//     // validation errors
//     if(err.message.includes('Users validation failed')){
//         Object.values(err.errors).forEach( ({properties}) => {
//             errors[properties.path] = properties.message;
//         })
//     }

//     return errors;
// }

// // create new user by admin
// router.post('/', async(req, res) => {
//     const allowedProperties = UserModel.getOnCreateBindAllowedProperties();
//     const newUserBeforeSave = {};
//     for(let allowedProperty of allowedProperties){
//         // console.log(UserModel.schema.paths[allowedProperty]);
//         newUserBeforeSave[allowedProperty] = req.body[allowedProperty];
//     }
//     try {
//         const newUser = await UserModel.create(newUserBeforeSave);
//         res.json(newUser);
//     }
//     catch(err) {
//         const errors = handleErrors(err);
//         res.status(400).json({errors});
//     }
// });

module.exports = router;
