// const serverless = require("serverless-http");
const express = require("express");
const app = express();
const dotenv = require('dotenv').config();
var cors = require('cors')
const { errorHandler } = require('./backend/middleware/errorMiddleware');
// const { logger } = require('./backend/middleware/logMiddleware');
const db = require('./backend/config/db');
const colors = require('colors');
var busboy = require('connect-busboy');
const fileUpload = require("express-fileupload");
var path = require('path')
const morganBody = require('morgan-body');
const fs = require("fs");
var cron = require('node-cron');
app.use("/uploads", express.static("uploads"));
app.use(fileUpload({
  createParentPath: true
}));
const moment = require('moment-timezone');
// load db
db();



const { cronJob } = require('./backend/controllers/jobs/JobsController');


const date = moment().format('YYYY-MM-DD')
const accessLogStream = fs.createWriteStream(path.join(__dirname + '/backend/logs/', `access_${date}.log`), { flags: 'a' })






app.use(express.json())
// app.use(morgan(function (tokens, req, res) {
//   return [
//     tokens.method(req, res),
//     tokens.url(req, res),
//     tokens.status(req, res),
//     tokens('res-body', (req, res) =>
//       JSON.stringify(res.__custombody__),
//     ),
//     tokens.res(req, res, 'content-length'), '-',
//     tokens['response-time'](req, res), 'ms'
//   ].join(' ')
// }, { stream: accessLogStream }));


app.use(busboy());
app.use(express.urlencoded({ extended: false }))
// app.use(logger);
morganBody(app, { logAllReqHeader: true, maxBodyLength: 5000, stream: accessLogStream });

//cronjob
app.use(cors())
//cronjob
cron.schedule('* * * * *', () => {
  console.log('here in cronjob');
  cronJob();
});
// const http = require('http').Server(app);
// const io = require('socket.io')(http);
// app.use('/auth', cors(), require('./backend/routes/userRoutes'));
// app.use('/employer', cors(), require('./backend/routes/employerRoutes'));
// app.use('/worker', cors(), require('./backend/routes/workerRoutes'));
// app.use('/languages', cors(), require('./backend/routes/workerRoutes'));
// app.use('/job', cors(), require('./backend/routes/jobRoutes'));
// app.use('/admin', cors(), require('./backend/routes/adminRoutes'));
// app.use('/file', cors(), require('./backend/routes/fileHandlingRouter'));
app.use(errorHandler);
app.use((req, res, next) => {
  return res.status(404).json({
    error: "Route Not Found",
  });
});




app.listen(process.env.PORT_CRON, () => console.log(`Server listening in port ${process.env.PORT_CRON} url: http://localhost:${process.env.PORT_CRON}`))


// module.exports.api = serverless(app);
