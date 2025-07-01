const asyncHandler = require('express-async-handler');
const User = require('../schemas/User');
const { PrintError } = require('./common');
const fs = require("fs");
var getDirName = require('path').dirname
const moment = require('moment-timezone');

const logger = asyncHandler(async (req, res, next) => {


    const date = moment().format('YYYY-MM-DD');
    const filepath = __dirname + `/backend/logs/access_${date}.log`;
    const file = fs.existsSync(filepath);
    if (file !== false) {
        fs.writeFileSync(`backend/logs/${date}_access.json`, JSON.stringify({}), 'utf8', function (err) {
            if (err) {
                throw new Error(err);
            }
        });

    }
    return next();

})

module.exports = {
    logger
}