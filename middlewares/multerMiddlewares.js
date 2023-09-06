// TODO: sanitize filename middleware

const multer = require("multer");
const path = require("path");
const fsPromises = require("fs").promises;
const sanitize = require("sanitize-filename");

const {profileImageFileSizeInMB} = require("../config");

/**
 * filename generator middleware
 * decides how to name uploaded file
 * based on these constants
 */
const uploadedFileTypes = {
  departmentImage: "departmentImage",
};

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!req?.uploadPath) {
      return cb(
        new Error(
          "destination not specified, middleware populateUploadPath is not called"
        ),
      );
    }
    return cb(null, req?.uploadPath);
  },

  filename: (req, file, cb) => {    
    if (!req?.generatedFilename) {
      return cb(
        new Error(
          "file name not specified, middleware populateFilename is not called"
        ),
      );
    }
    const fileNameWithExtension =
      req?.generatedFilename + path.extname(file.originalname);
    return cb(null, fileNameWithExtension);
  },
});

const uploadMiddleware = multer({
  storage: diskStorage,
  // fileFilter: () => {},
  limits: {
    fileSize: profileImageFileSizeInMB * 1024 * 1024,
  },
});

/* a middleware[wrapper] to populate destination path for uploaded file
 * any route handler that wants to use upload middleware
 * should call this middleware before the upload
 * the generated path will be assigned to req.uploadPath
 * so upload middleware can read that property
 *
 * this middleware throws error if the full path does not exist
 * the path's are specified in config.js as constant object
 * in app.js (when initilizing server) the nested directories are made
 * based on the constants
 */
function populateUploadPath(relativePath) {
  return async (req, res, next) => {
    const projectRootDir = path.join(__dirname, "../");
    const absolutePath = path.join(projectRootDir, relativePath);

    try {
      // if path exists
      // the promise resolved value is undefined!
      // if not exist
      // promise rejects (throws error)
      await fsPromises.access(absolutePath);
    } catch (err) {
      return res.status(500).json({
        error: {
          message: `Directory '${relativePath}' is not created`,
          // contains full filesystem path, should not be exposed to client
          // details: err?.message,
        },
      });
    }

    req.uploadPath = absolutePath;
    return next();
  };
}

/**
 * this middleware also
 * should be called before upload middleware
 * to assign generated filename to req.generatedFilename
 * so upload middleware can access it from req object
 *
 * naming file depends on the type of uploaded file
 * for example: profile image for an existing department
 * the function looks for _id and the title of department in the req.departmentDoc
 * so the getDepartment middleware should be called before this middleware
 * otherwise returns error response
 *
 * the type of uploaded files to handle
 * are specified as a constant object in this file
 */
function populateFileName(uploadedFileType) {
  return (req, res, next) => {
    if (uploadedFileType === uploadedFileTypes.departmentImage) {
      const departmentDoc = req?.departmentDoc;
      if (!departmentDoc) {
        return res.status(500).json({
          error: { message: "getDepartment middleware is not called" },
        });
      }

      // replce white space with '-'
      let sanitizedTitle = departmentDoc?.title?.replace(/ /g, "-");
      sanitizedTitle = sanitize(sanitizedTitle);
      const generatedFilename = departmentDoc?._id + "__" + sanitizedTitle;

      req.generatedFilename = generatedFilename;
      return next();
    }

    return res
      .status(500)
      .json({ error: { message: "uploadedFileType is not defined" } });
  };
}

module.exports = {
  uploadMiddleware,
  populateUploadPath,
  populateFileName,
  uploadedFileTypes,
};
