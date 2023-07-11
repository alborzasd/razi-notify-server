const express = require('express');
const Constants = require('../models/Constans');
const { handleErrors } = require("./utilities");

const router = express.Router();

router.get('/system_roles', (req, res) => {
  try {
    const systemRoles = Constants.systemRoleValues;
    const result = systemRoles.map((systemRole, index) => {
      return {
        _id: index,
        title: systemRole,
        title_persian: Constants.getSystemRolePersian(systemRole)
      }
    });
    return res.json({data: result});
  }
  catch(err) {
    const { status, errorData } = handleErrors(err, "users");
    return res.status(status).json({ error: errorData });
  }
});

router.get('/student_positions', (req, res) => {
  try {
    const studentPositions = Constants.studentPositionValues;
    const result = studentPositions.map((studentPosition, index) => {
      return {
        _id: index,
        title: studentPosition,
        title_persian: Constants.getStudentPositionPersian(studentPosition)
      }
    });
    return res.json({data: result});
  }
  catch(err) {
    const { status, errorData } = handleErrors(err, "users");
    return res.status(status).json({ error: errorData });
  }
});

router.get('/lecturer_positions', (req, res) => {
  try {
    const lecturerPositions = Constants.lecturerPositionValues;
    const result = lecturerPositions.map((lecturerPosition, index) => {
      return {
        _id: index,
        title: lecturerPosition,
        title_persian: Constants.getLecturerPositionPersian(lecturerPosition)
      }
    });
    return res.json({data: result});
  }
  catch(err) {
    const { status, errorData } = handleErrors(err, "users");
    return res.status(status).json({ error: errorData });
  }
});

module.exports = router;