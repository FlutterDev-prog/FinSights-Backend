const express = require('express');
const config = require('config');
const http = require('http');
const socketio = require('socket.io');
const appRouter = require('./routes/appLinks');
const userRouter = require('./routes/usersRouter');
const requestUser = require('./routes/requestHandler');
const notifyRouter = require('./routes/notification');
const checkNetworkConnectivity = require('./middleware/CheckNetwork');
const connectDB = require('./Connection/Connection'); // Import the connectDB function

const app = express();
const server = http.createServer(app);
const io = socketio(server).sockets;

// Middleware
app.use(express.json());
app.use(checkNetworkConnectivity);

app.use(requestUser);
app.use(appRouter);
app.use(userRouter);
app.use(notifyRouter);

const startServer = async () => {
  try {
    const db = await connectDB();

    require('./middleware/socket')(app, io, db);

    const port = process.env.PORT || 5000;

    server.listen(port, () => {
      console.log(`Server started on port ${port}`);
    });
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1); // Exit process with failure
  }
};

startServer();