const Chats = require("../schema/Chats");
const { v4: uuidV4 } = require("uuid");

const addUser = ({ receiverEmail, senderEmail }, socket) => {
    if (!senderEmail || !receiverEmail) {
        return {
            error: "You tried to add zero chat"
        };
    }
    const users = { receiverEmail, senderEmail };
    console.log(users);

    Chats.aggregate([
        {
            $match: { receiverEmail, senderEmail },
        }
    ]).then((chat) => {
        if (chat.length > 0) {
            socket.emit('openChat', { ...chat[0] })
        } else {
            Chats.aggregate([
                {
                    $match: { receiverEmail: senderEmail, senderEmail: receiverEmail }
                }
            ]).then(async (lastAttempt) => {
                if (lastAttempt.length > 0) {
                    socket.emit('openChat', { ...lastAttempt[0] })
                } else {

                    const newRoomId = uuidV4();
                    // The case Where chat dosenot Exisits
                    const newChat = {
                        ...users, roomId: uuidV4()
                    }

                    socket.emit('openChat', { ...newChat });
                    await new Chats({
                        senderEmail: users.senderEmail,
                        receiverEmail: users.receiverEmail,
                        roomId: newRoomId
                    }).save();
                }

            });
        }
    });

};

module.exports = { addUser };
