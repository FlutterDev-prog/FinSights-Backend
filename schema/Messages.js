const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const MessagesSchema = new Schema({
    _id: { type: String },
    roomId: { type: String, required: true },
    senderEmail: { type: String, required: true },
    receiverEmail: { type: String, required: true },
    message: { type: String, required: true },
},{ timestamps: true });

module.exports = Messages = mongoose.model("messages", MessagesSchema);
