const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const moment = require('moment-timezone');

const MessagesSchema = new Schema({
    roomId: { type: String, required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true },
    createdAt: { type: Date, default: moment().tz('Asia/Kolkata').format() },
    updatedAt: { type: Date, default: moment().tz('Asia/Kolkata').format() },
    read: { type: Boolean, default: false },
    file: {
        filename: { type: String },
        contentType: { type: String },
        fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'fs.files' }
    }
});


module.exports = Messages = mongoose.model("messages", MessagesSchema);
