const mongoose = require('mongoose');
const uri = process.env.MONGO_DB;
mongoose.set('strictQuery', true);
const db = async () => {
    // try {
    //     console.log('using existing connection');
    //     if (!conn) {
    //         console.log('initializing new connection');
    //         conn = await mongoose.connect(process.env.MONGO_DB, {
    //             useNewUrlParser: true,
    //             // useFindAndModify: false,
    //             useUnifiedTopology: true,
    //             bufferCommands: true, // Disable mongoose buffering
    //             // useCreateIndex: true
    //         })
    //         console.log(`Mongodb connected: ${conn.connection.host}`.cyan.underline);
    //     }
    // } catch (error) {
    //     console.log(error)
    //     console.error("Could not connect to MongoDB...");
    //     throw error;
    //     process.exit(1)
    // }

    mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true, autoIndex: true, dbName: "" });

    mongoose.connection.on('connected', function () {
        console.log("Database connection established".cyan.underline);
    });

    mongoose.connection.on('error', function (err) {
        console.log("Database connection has occurred " + err + " error".red.underline);
    });

    mongoose.connection.on('disconnected', function () {
        console.log("Database connection is disconnected".white.underline);
    });

    process.on('SIGINT', function () {
        mongoose.connection.close().then(() => {
            console.log("Database connection is disconnected due to application termination".grey.underline);
            process.exit(0);
        }).catch((err) => {
            console.log("Error while closing database connection: " + err + "".cyan.underline);
            process.exit(1);
        });
    });
}

module.exports = db