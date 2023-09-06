// this file contains functions that run when server starts

const { availableUploadPath, projectRootDir } = require("../config");
const chalk = require("chalk");

const fs = require("fs");
const path = require("path");

function generateUploadDirectories() {
  Object.values(availableUploadPath).forEach((relativePath) => {
    const absolutePath = path.join(projectRootDir, relativePath);

    // it runs on server startup, so sync does not affect performance
    if (!fs.existsSync(absolutePath)) {
      fs.mkdirSync(absolutePath, { recursive: true });
      console.log(chalk.bgCyan('Directory created:'), relativePath);
    }
  });
  console.log(chalk.bgCyan("Upload directories created/exists"));
}

function initServer() {
  generateUploadDirectories();
}

module.exports = initServer;
