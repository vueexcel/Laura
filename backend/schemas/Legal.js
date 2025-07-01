const mongoose = require('mongoose');



const legalSettings = new mongoose.Schema({
    faq: { type: mongoose.Schema.Types.Mixed, default: {} },
    tac: { type: String, default: '' },
    privacy: { type: String, default: '' },
    about: { type: String, default: "" },
}, {
    timestamps: true,
})

module.exports = mongoose.model('legal', legalSettings);