const mongoose = require('mongoose');

const DevicesSchema = mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users"
    },
    device_id: {
        type: String,
    },
    device_type: {
        type: String,
    }
}, {
    timestamps: true,
})

module.exports = mongoose.model("devices", DevicesSchema)