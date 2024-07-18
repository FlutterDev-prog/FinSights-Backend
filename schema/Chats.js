const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ChatsSchema = new Schema({
    senderEmail: {
        type:String,
    },
    receiverEmail: {
        type:String,
    },
    roomId: {
        type: String,
        required: true,
    }
},{ timestamps: true });

module.exports = Chats = mongoose.model("chats", ChatsSchema);
