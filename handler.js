// const serverless = require("serverless-http");
const express = require("express");
const app = express();
const dotenv = require('dotenv').config();
var cors = require('cors')
const { errorHandler } = require('./backend/middleware/errorMiddleware');
const colors = require('colors');
var busboy = require('connect-busboy');
var path = require('path')
const morganBody = require('morgan-body');
const fs = require("fs");
var cron = require('node-cron');
app.use("/uploads", express.static("uploads"));

// Note: MongoDB connection is no longer used as we've switched to Firestore

const moment = require('moment-timezone');
// Firestore is initialized in firestoreHelper.js
const date = moment().format('YYYY-MM-DD')
const accessLogStream = fs.createWriteStream(path.join(__dirname + '/backend/logs/', `access_${date}.log`), { flags: 'a' })


app.use(express.json())
app.use(express.urlencoded({ extended: false }))
morganBody(app, { logAllReqHeader: true, maxBodyLength: 5000, stream: accessLogStream });

app.use(cors())




app.use('/api/auth', cors(), require('./backend/routes/userRoutes'));
app.use('/api/product', cors(), require('./backend/routes/productRoutes'));
app.use('/api/file', cors(), require('./backend/routes/fileHandlingRouter'));
app.use('/api/transcription', cors(), require('./backend/routes/transcriptionRoutes'));
app.use('/api/response', cors(), require('./backend/routes/responseRoutes'));
app.use('/api/voice', cors(), require('./backend/routes/voiceRoutes'));

app.use(errorHandler);
app.use((req, res, next) => {
  return res.status(404).json({
    error: "Route Not Found",
  });
});


app.listen(process.env.PORT, () => console.log(`Server listening in port ${process.env.PORT} url: http://localhost:${process.env.PORT}`));


// module.exports.api = serverless(app);
