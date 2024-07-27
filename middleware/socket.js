const { GridFSBucket } = require('mongodb');
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
    console.log('New socket connection established');

    socket.on('joinTwoUsers', ({ roomId }) => {
      socket.join(roomId);
    });

    socket.on('clearChat', async ({ roomId }) => {
      await Messages.deleteMany({ 'roomId': roomId })
      socket.emit('clearedChat');
    });

    socket.on('blockUser', async ({ userId, blockUserId }) => {
      try {
        const user = await User.findById(userId);
        if (!user) {
          return socket.emit('error', 'User not found');
        }

        if (!user.blockedUsers.includes(blockUserId)) {
          user.blockedUsers.push(blockUserId);
          await user.save();
          socket.emit('userBlocked', blockUserId);
          console.log(`User ${userId} blocked user ${blockUserId}`);
        } else {
          socket.emit('error', 'User already blocked');
        }
      } catch (error) {
        console.error('Error blocking user:', error);
        socket.emit('error', 'Error blocking user');
      }
    });

    socket.on('clearChat', async ({ roomId }) => {
      await Messages.deleteMany({ 'roomId': roomId });
      socket.broadcast.to(roomId).emit('clearedChats');
    });

    socket.on('unblockUser', async ({ userId, unblockUserId }) => {
      try {
        const user = await User.findById(userId);
        if (!user) {
          return socket.emit('error', 'User not found');
        }

        if (user.blockedUsers.includes(unblockUserId)) {
          user.blockedUsers = user.blockedUsers.filter(id => id.toString() !== unblockUserId);
          await user.save();
          socket.emit('userUnblocked', unblockUserId);
          console.log(`User ${userId} unblocked user ${unblockUserId}`);
        } else {
          socket.emit('error', 'User is not blocked');
        }
      } catch (error) {
        console.error('Error unblocking user:', error);
        socket.emit('error', 'Error unblocking user');
      }
    });

    socket.on('sendToUser', async (data) => {
      const { roomId, senderId, receiverId, message, file } = data;

      const sender = await User.findById(senderId);
      const receiver = await User.findById(receiverId);

      if (sender.blockedUsers.includes(receiverId)) {
        return socket.emit('error', 'You cannot send a message to this user as they have blocked you.');
      }

      if (receiver.blockedUsers.includes(senderId)) {
        return socket.emit('error', 'You cannot send a message to this user as you have blocked them.');
      }

      socket.broadcast.to(data.roomId).emit('dispatchMsg', { ...data });

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
                await Chats.findByIdAndUpdate(
                  { _id: roomId },
                  { lastMessage: message }
                );
                console.log('Message saved successfully');
                if (senderId !== receiverId) {
                  await incrementUnreadMessageCount(roomId, receiverId);
                  socket.emit('unreadAdded');
                }
              } catch (error) {
                console.error('Error saving message after file upload:', error);
              }
            });

        } else {
          await newMessage.save();
          await Chats.findByIdAndUpdate(
            { _id: roomId },
            { lastMessage: message }
          );
          console.log('Message saved successfully');

          if (senderId !== receiverId) {
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

      try {
        const sender = await User.findById(senderId);
        if (sender.blockedUsers.includes(receiverId)) {
          return socket.emit('loadUniqueChat', []);
        }

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

        socket.emit('loadUniqueChat', chats);
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
