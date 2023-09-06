const { model: DepartmentModel } = require("../models/Department");

const { isValidObjectId } = require("../routes/utilities");

async function getDepartment(req, res, next) {
  try {
    const departmentId = req?.params?.departmentId;

    const errorData = {
      message: `There is no department with id: ${departmentId}`,
      messagePersian: `دانشکده ای با شناسه  ${departmentId} یافت نشد.`,
    };

    if (!isValidObjectId(departmentId)) {
      return res.status(404).json({
        error: errorData,
      });
    }

    // if we remove condition above
    // the invalid object id throws error and returns status 500 to client
    // but we want to return 404
    const departmentDoc = await DepartmentModel.findById(departmentId);

    if (!departmentDoc) {
      return res.status(404).json({
        error: errorData,
      });
    }

    req.departmentDoc = departmentDoc;
    return next();
  } catch (err) {
    return res.status(500).json({ error: { message: err.message } });
  }
}

module.exports = {
  getDepartment,
};
