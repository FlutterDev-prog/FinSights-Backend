const { GridFSBucket, UUID } = require('mongodb');
const fs = require('fs');
const Chats = require('../schema/Chats');
const Messages = require('../schema/Messages');
const { addUser } = require('../helpers/misc');
const mongoose = require('mongoose');
const User = require('../schema/users');
const { v4: uuidV4 } = require("uuid");

module.exports = (app, io, db) => {
  // Ensure db is correctly passed and accessible
  if (!db || !db.db) {
    console.error('MongoDB connection is not available.');
    return;
  }

  const bucket = new GridFSBucket(db.db);

  io.on("connection", function (socket) {
    socket.on('getUserChats', async ({ senderId }) => {
      try {
        const chatRooms = await Chats.aggregate([
          {
            $match: {
              $or: [
                { senderId: new mongoose.Types.ObjectId(senderId) },
                { receiverId: new mongoose.Types.ObjectId(senderId) }
              ]
            }
          },
          {
            $lookup: {
              from: 'users',
              localField: 'senderId',
              foreignField: '_id',
              as: 'senderDetails'
            }
          },
          {
            $lookup: {
              from: 'users',
              localField: 'receiverId',
              foreignField: '_id',
              as: 'receiverDetails'
            }
          },
          {
            $project: {
              _id: 1,
              roomId: 1,
              senderId: 1,
              receiverId: 1,
              updatedAt: 1,
              otherUserDetails: {
                $cond: {
                  if: { $eq: ['$senderId', new mongoose.Types.ObjectId(senderId)] },
                  then: {
                    _id: { $arrayElemAt: ['$receiverDetails._id', 0] },
                    firstName: { $arrayElemAt: ['$receiverDetails.firstName', 0] },
                    userName: { $arrayElemAt: ['$receiverDetails.userName', 0] },
                    email: { $arrayElemAt: ['$receiverDetails.email', 0] },
                    phone: { $arrayElemAt: ['$receiverDetails.phone', 0] },
                    isGoogleAccount: { $arrayElemAt: ['$receiverDetails.isGoogleAccount', 0] },
                    createdAt: { $arrayElemAt: ['$receiverDetails.createdAt', 0] },
                    updatedAt: { $arrayElemAt: ['$receiverDetails.updatedAt', 0] },
                    __v: { $arrayElemAt: ['$receiverDetails.__v', 0] }
                  },
                  else: {
                    _id: { $arrayElemAt: ['$senderDetails._id', 0] },
                    firstName: { $arrayElemAt: ['$senderDetails.firstName', 0] },
                    userName: { $arrayElemAt: ['$senderDetails.userName', 0] },
                    email: { $arrayElemAt: ['$senderDetails.email', 0] },
                    phone: { $arrayElemAt: ['$senderDetails.phone', 0] },
                    isGoogleAccount: { $arrayElemAt: ['$senderDetails.isGoogleAccount', 0] },
                    createdAt: { $arrayElemAt: ['$senderDetails.createdAt', 0] },
                    updatedAt: { $arrayElemAt: ['$senderDetails.updatedAt', 0] },
                    __v: { $arrayElemAt: ['$senderDetails.__v', 0] }
                  }
                }
              }
            }
          },
          {
            $sort: { updatedAt: -1 }
          }
        ]);

        console.log(chatRooms);
        io.emit('userChats', chatRooms);
      } catch (e) {
        console.error(e);
      }
    });


    socket.on('startUniqueChat', ({ senderId, receiverId }) => {
      console.log("Hello in unique chat");
      addUser({ receiverId, senderId }, socket);
    });

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
        { $set: { updatedAt: Date.now() } }
      );

      try {
        const newMessage = new Messages({
          roomId,
          senderId,
          receiverId,
          message,
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
              } catch (error) {
                console.error('Error saving message after file upload:', error);
              }
            });

        } else {
          await newMessage.save();
          console.log('Message saved successfully');
        }
      } catch (error) {
        console.error('Error saving message:', error);
      }
    });

    socket.on('load_user_chats', async (data) => {
      const { receiverId, senderId } = data;

      // Convert string IDs to ObjectId
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
  });
}
