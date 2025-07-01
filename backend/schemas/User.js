const mongoose = require('mongoose');

const UserSchema = mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a username'],
    },
    email: {
        type: String,
        required: [true, 'Please add an email'],
    },
    phone: {
        type: String,
        default: "",
    },
    timezone: {
        type: String,
        default: "",
    },
    image: {
        type: String,
        default: "noImg.png",
    },
    social_id: {
        type: String,
        default: "",
    },
    social_type: {
        type: String,
        default: "normal",
    },
    reset_code: {
        type: String,
        default: "",
    },
    otp: {
        type: String,
        default: "",
    },
    is_active: {
        type: Boolean,
        default: true,
    },
    terms_accepted: {
        type: Boolean,
        default: false
    },
    user_type: {
        type: Number,
        default: 2,
    },
    is_deleted: {
        type: Boolean,
        default: false
    },
    original_email: {
        type: String,
        default: ""
    },
    original_name: {
        type: String,
        default: ""
    },
    password: {
        type: String,
        required: [true, 'Please add a password'],
    },
    onboarding:{
        type:mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true,
})

module.exports = mongoose.model("users", UserSchema)