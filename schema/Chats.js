const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const { v4: uuidV4 } = require("uuid");

const ChatsSchema = new Schema({
    _id: { type: String, default: uuidV4 }, // Use String type for _id
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    roomId: { type: String, required: true },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = Chats = mongoose.model("chats", ChatsSchema);
