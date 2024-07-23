const { GridFSBucket, UUID } = require('mongodb');
const fs = require('fs');
const Chats = require('../schema/Chats');
const Messages = require('../schema/Messages');
const mongoose = require('mongoose');
const User = require('../schema/users');
const moment = require('moment-timezone');

const incrementUnreadMessageCount = async (roomId, receiverId) => {
  await Chats.updateOne(
    { roomId: roomId, receiverId: receiverId },
    { $inc: { unreadMessageCount: 1 } }
  );
};

const markMessagesAsRead = async (roomId, receiverId) => {
  await Messages.updateMany(
    { roomId: roomId, receiverId: receiverId, read: false },
    { $set: { read: true } }
  );

  await Chats.updateOne(
    { roomId: roomId, receiverId: receiverId },
    { $set: { unreadMessageCount: 0 } }
  );
};

module.exports = (app, io, db) => {
  if (!db || !db.db) {
    console.error('MongoDB connection is not available.');
    return;
  }

  const bucket = new GridFSBucket(db.db);

  io.on("connection", function (socket) {

    socket.on('joinTwoUsers', ({ roomId }) => {
      socket.join(roomId);
    });

    socket.on('sendToUser', async (data) => {
      socket.broadcast.to(data.roomId).emit('dispatchMsg', { ...data });

      const { roomId, senderId, receiverId, message, file } = data;

      const senderObjectId = new mongoose.Types.ObjectId(senderId);
      const receiverObjectId = new mongoose.Types.ObjectId(receiverId);

      await Chats.updateOne(
        {
          $or: [
            { senderId: senderObjectId, receiverId: receiverObjectId },
            { senderId: receiverObjectId, receiverId: senderObjectId }
          ]
        },
        { $set: { updatedAt: moment().tz('Asia/Kolkata').format() } }
      );

      try {
        const istDate = moment().tz('Asia/Kolkata').format();
        const newMessage = new Messages({
          roomId,
          senderId,
          receiverId,
          message,
          createdAt: istDate,
          updatedAt: istDate,
        });

        if (file) {
          const fileStream = fs.createReadStream(file.path);
          const uploadStream = bucket.openUploadStream(file.originalname);
          const fileId = uploadStream.id;

          fileStream.pipe(uploadStream)
            .on('error', (error) => {
              console.error('Error uploading file to GridFS:', error);
            })
            .on('finish', async () => {
              console.log('File uploaded to GridFS');

              newMessage.file = {
                filename: file.originalname,
                contentType: file.mimetype,
                fileId: fileId,
              };

              try {
                await newMessage.save();
                console.log('Message saved successfully');
                if (senderId !== receiverId) { // Ensure that unread message count is incremented only for the receiver
                  await incrementUnreadMessageCount(roomId, receiverId);
                }
              } catch (error) {
                console.error('Error saving message after file upload:', error);
              }
            });

        } else {
          await newMessage.save();
          console.log('Message saved successfully');
          if (senderId !== receiverId) { // Ensure that unread message count is incremented only for the receiver
            await incrementUnreadMessageCount(roomId, receiverId);
          }
        }
      } catch (error) {
        console.error('Error saving message:', error);
      }
    });

    socket.on('load_user_chats', async (data) => {
      const { receiverId, senderId } = data;

      const senderObjectId = new mongoose.Types.ObjectId(senderId);
      const receiverObjectId = new mongoose.Types.ObjectId(receiverId);

      console.log('Sender ObjectId:', senderObjectId);
      console.log('Receiver ObjectId:', receiverObjectId);

      try {
        const chats = await Messages.aggregate([
          {
            $match: {
              $or: [
                { receiverId: receiverObjectId, senderId: senderObjectId },
                { senderId: receiverObjectId, receiverId: senderObjectId }
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
      } catch (error) {
        console.error('Error loading chats:', error);
        socket.emit('error', 'Error loading chats');
      }
    });

    socket.on('updateStatus', async (data) => {
      const { userId, isActive } = data;

      await User.findByIdAndUpdate({ _id: userId }, { isActive: isActive });
      socket.broadcast.emit('updatedStatus', { userId, isActive });
    });

    socket.on('markMessagesAsRead', async (data) => {
      const { roomId, receiverId } = data;
      try {
        await markMessagesAsRead(roomId, receiverId); // Mark messages as read
        console.log('Messages marked as read successfully');
        socket.broadcast.emit('markedAsRead');
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    });
  });
};
