const express = require("express");
const path = require("path");
const fsPromises = require("fs").promises;

const { model: DepartmentModel } = require("../models/Department");
const { model: UserModel } = require("../models/User");

const { collectionName: usersCollectionName } = require("../models/User");
const { collectionName: channelsCollectionName } = require("../models/Channel");

const { getDepartment } = require("../middlewares/departmentMiddlewares");
const {
  uploadMiddleware,
  populateUploadPath,
  populateFileName,
  uploadedFileTypes,
} = require("../middlewares/multerMiddlewares");

const { availableUploadPath, projectRootDir } = require("../config");

const { handleErrors } = require("./utilities");

const { requireRole } = require("../middlewares/roleMiddlewares");
const { systemRoleEnum } = require("../models/Constans");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const departments = await DepartmentModel.find();
    res.json({ data: departments });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

router.get("/report", async (req, res) => {
  try {
    const result = await DepartmentModel.aggregate([
      // get users of each department, assign to 'user' array field
      {
        $lookup: {
          from: usersCollectionName,
          localField: "_id",
          foreignField: "department_id",
          as: "user",
        },
      },
      // keep only necessary fields
      {
        $project: {
          _id: 1,
          title: 1,
          "user._id": 1,
          profile_image_filename: 1,
          // "user.first_name": 1,
        },
      },
      // duplicate deparment docuemtns for each user in 'user' field array (group it later)
      // preserve department documents that 'user' field of them is empty array
      // in the preserved documents, 'user' field does not exist
      {
        $unwind: {
          path: "$user",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: channelsCollectionName,
          localField: "user._id",
          foreignField: "owner_id",
          as: "channel_list",
        },
      },
      {
        $group: {
          // group based on _id of departments
          _id: "$_id",
          title: { $first: "$title" },
          profile_image_filename: { $first: "$profile_image_filename" },
          users_count: {
            $sum: {
              $cond: [
                { $ifNull: ["$user", null] }, // Check if 'user' field exists
                1, // Return 1 if 'user' field exists
                0, // Return 0 if 'user' field does not exist
              ],
            },
          },
          channels_count: { $sum: { $size: "$channel_list" } },
        },
      },
      {
        $sort: {
          _id: 1,
        },
      },
    ]);

    res.json({ data: result });
  } catch (err) {
    const { status, errorData } = handleErrors(err, "channels");
    return res.status(status).json({ error: errorData });
  }
});

router.post("/", requireRole([systemRoleEnum.root_admin]), async (req, res) => {
  try {
    const departmentBeforeSave = new DepartmentModel();
    const allowedFields = DepartmentModel.getOnBindAllowedFields("create");
    for (let fieldName in req?.body) {
      if (allowedFields.includes(fieldName)) {
        departmentBeforeSave[fieldName] = req?.body?.[fieldName];
      }
    }
    const departmentDoc = await departmentBeforeSave.save();
    res.status(201).json({ data: departmentDoc });
  } catch (err) {
    const { status, errorData } = handleErrors(err, "departments");
    return res.status(status).json({ error: errorData });
  }
});

router.patch(
  "/:departmentId",
  requireRole([systemRoleEnum.root_admin]),
  getDepartment,
  async (req, res) => {
    try {
      const departmentDoc = req?.departmentDoc;
      const allowedFields = DepartmentModel.getOnBindAllowedFields("update");
      for (let fieldName in req?.body) {
        if (allowedFields.includes(fieldName)) {
          departmentDoc[fieldName] = req?.body?.[fieldName];
        }
      }

      await departmentDoc.save();
      res.json({ data: { message: "Department edited successfully" } });
    } catch (err) {
      const { status, errorData } = handleErrors(err, "departments");
      return res.status(status).json({ error: errorData });
    }
  }
);

// change profile image url of an existing department
router.patch(
  "/:departmentId/profile-image",
  requireRole([systemRoleEnum.root_admin]),
  getDepartment,
  populateUploadPath(availableUploadPath.departmentsImage),
  populateFileName(uploadedFileTypes.departmentImage),
  uploadMiddleware.single("department-image"),
  async (req, res) => {
    try {
      const departmentDoc = req?.departmentDoc;

      const newStoredFilename = req?.file?.filename;
      const oldFilename = departmentDoc?.profile_image_filename;

      // full filesystempath to the directory of
      // uploaded department images
      const uploadedFilePath = path.join(
        projectRootDir,
        availableUploadPath.departmentsImage
      );

      // before reaching this router handler
      // the new file is already stored in static directory
      // the new filename without extension is exacly same as old filename(if exist)
      // becuase it's genrated based on the _id and title of department
      // but extensions could be different
      //
      // for example: old uploaded file is 'id__title.png'
      // but new file is 'id__title.jpg'
      // in this case the old file should be removed here
      //
      // another example: old uploaded file is 'id_title1.png'
      // new file is 'id__title2.png'
      // in this case also, the old file should be removed
      //
      // if extensions are same, we dont do anything
      // the new file is already replaced with old file
      // because the names are exacly the same
      //
      // if there is no old file we dont do anything
      //
      // to check if there is any old uploaded file
      // we must check departmentDoc?.profile_image_filename
      // we can't just check filesystem because the old file may be replaced (as explained)

      if (oldFilename && oldFilename !== newStoredFilename) {
        const oldFilePath = path.join(uploadedFilePath, oldFilename);
        // if successfull returns undefined
        // if error, catched by the below catch block
        await fsPromises.unlink(oldFilePath);
      }

      departmentDoc.profile_image_filename = newStoredFilename;
      await departmentDoc?.save();

      res.json({ data: { message: "Department image edited successfully" } });
    } catch (err) {
      const { status, errorData } = handleErrors(err);
      return res.status(status).json({ error: errorData });
    }
  }
);

router.delete(
  "/:departmentId",
  requireRole([systemRoleEnum.root_admin]),
  getDepartment,
  async (req, res) => {
    try {
      const departmentDoc = req?.departmentDoc;

      const numUsersInDepartment = await UserModel.countDocuments({
        department_id: departmentDoc?._id,
      });

      // DO NOT delete deparment if at least has one user
      if (numUsersInDepartment > 0) {
        return res.status(403).json({
          error: {
            message:
              "Department" +
              " " +
              departmentDoc?.title +
              " " +
              "has" +
              " " +
              numUsersInDepartment +
              " " +
              "number of users. delete users or move them to another department",
            messagePersian:
              "دانشکده/بخش" +
              " " +
              departmentDoc?.title +
              ", " +
              numUsersInDepartment +
              " " +
              "کاربر عضو دارد." +
              " " +
              "کاربران را حذف کرده یا به دانشکده/بخش دیگری منتقل کنید.",
          },
        });
      }

      ///////////////////////////
      // remove profile image
      const oldFilename = departmentDoc?.profile_image_filename;
      if (oldFilename) {
        // directory of uploaded file
        const uploadedFilePath = path.join(
          projectRootDir,
          availableUploadPath.departmentsImage
        );
        // full path with name of the uploaded file
        const oldFilePath = path.join(uploadedFilePath, oldFilename);
        // if successfull returns undefined
        // if error, catched by the below catch block
        await fsPromises.unlink(oldFilePath);
      }
      ///////////////////////////

      await DepartmentModel.deleteOne({ _id: departmentDoc?._id });
      res.json({ data: { message: "Department removed successfully" } });
    } catch (err) {
      const { status, errorData } = handleErrors(err);
      return res.status(status).json({ error: errorData });
    }
  }
);

// remove profile image (and it's associated file) from departmentId
router.delete(
  "/:departmentId/profile-image",
  requireRole([systemRoleEnum.root_admin]),
  getDepartment,
  async (req, res) => {
    try {
      const departmentDoc = req?.departmentDoc;
      const oldFilename = departmentDoc?.profile_image_filename;

      if (oldFilename) {
        // directory of uploaded file
        const uploadedFilePath = path.join(
          projectRootDir,
          availableUploadPath.departmentsImage
        );
        // full path with name of the uploaded file
        const oldFilePath = path.join(uploadedFilePath, oldFilename);
        // if successfull returns undefined
        // if error, catched by the below catch block
        await fsPromises.unlink(oldFilePath);
      }

      // unset field
      departmentDoc.profile_image_filename = undefined;
      await departmentDoc.save();

      return res.json({
        data: { message: "Department image removed successfully" },
      });
    } catch (err) {
      const { status, errorData } = handleErrors(err);
      return res.status(status).json({ error: errorData });
    }
  }
);

module.exports = router;
