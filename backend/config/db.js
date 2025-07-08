// This file is kept for reference but is no longer used
// The application now uses Firestore for data storage instead of MongoDB

// MongoDB connection code (commented out as it's no longer used)
// const mongoose = require('mongoose');
// const uri = process.env.MONGO_DB;
// mongoose.set('strictQuery', true);
// const db = async () => {
//     mongoose.connect(uri, { 
//         useNewUrlParser: true, 
//         useUnifiedTopology: true, 
//         autoIndex: true,
//         dbName: "laura"
//     });

//     mongoose.connection.on('connected', function () {
//         console.log("Database connection established".cyan.underline);
//     });

//     mongoose.connection.on('error', function (err) {
//         console.log("Database connection has occurred " + err + " error".red.underline);
//     });

//     mongoose.connection.on('disconnected', function () {
//         console.log("Database connection is disconnected".white.underline);
//     });

//     process.on('SIGINT', function () {
//         mongoose.connection.close().then(() => {
//             console.log("Database connection is disconnected due to application termination".grey.underline);
//             process.exit(0);
//         }).catch((err) => {
//             console.log("Error while closing database connection: " + err + "".cyan.underline);
//             process.exit(1);
//         });
//     });
// }

// module.exports = db

// Firestore is now initialized in firestoreHelper.js