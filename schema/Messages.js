const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const { v4: uuidV4 } = require("uuid");

const MessagesSchema = new Schema({
    roomId: { type: String, required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true },
    file: {
        filename: { type: String },
        contentType: { type: String },
        fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'fs.files' } 
    }
}, { timestamps: true });

module.exports = Messages = mongoose.model("messages", MessagesSchema);
