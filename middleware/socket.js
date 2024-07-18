const { addUser } = require("../helpers/misc");
const Messages = require("../schema/Messages");
const User = require("../schema/users");

module.exports = (app, io, db) => {
  io.on("connection", function (socket) {
    socket.on('getUsers', async ({ senderEmail }) => {
      try {
        const data = await User.find({ email: { $ne: senderEmail } });
        io.emit('allUsers', data);
      } catch (error) {
        console.error('Error fetching users:', error);
        io.emit('error', 'Error fetching users');
      }
    });

    socket.on('startUniqueChat', ({ senderEmail, receiverEmail }) => {
      console.log("Hello in unique chat")
      addUser({ receiverEmail, senderEmail }, socket);
    });

    socket.on('joinTwoUsers', ({ roomId }) => {
      socket.join(roomId);
    });

    socket.on('sendToUser', async (data) => {
      socket.broadcast.to(data.roomId).emit('dispatchMsg', { ...data });

      const { _id, roomId, senderEmail, receiverEmail, time, message } = data;

      await new Messages({
        _id,
        roomId,
        senderEmail,
        receiverEmail,
        message,
      }).save()
    });

    socket.on('load_user_chats', async (data) => {
      const { receiverEmail, senderEmail } = data;

      // Aggregating both sent and received messages in a single query
      const chats = await Messages.aggregate([
        {
          $match: {
            $or: [
              { receiverEmail, senderEmail },
              { senderEmail: receiverEmail, receiverEmail: senderEmail }
            ]
          }
        },
        {
          $sort: { createdAt: 1 }  
        }
      ]);

      if (chats.length > 0) {
        socket.emit('loadUniqueChat', chats);
      } else {
        socket.emit('loadUniqueChat', []);
      }
    });
  });
}
