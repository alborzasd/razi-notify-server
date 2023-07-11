const express = require('express');
const {model: DepartmentModel} = require('../models/Department');

const router = express.Router();

router.get('/', async(req, res) => {
  try {
    const departments = await DepartmentModel.find();
    res.json({data: departments});
  }
  catch(err) {
    res.status(500).json({error: {message: err.message}});
  }
});

module.exports = router;