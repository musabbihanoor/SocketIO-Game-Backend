const express = require("express");
const app = express();
const http = require("http");
const https = require("https");
const { Server } = require("socket.io");
const cors = require("cors");

const server = http.createServer(app);

require("dotenv").config();

// const io = require("socket.io")(server, {
//   cors: {
//     origin: "*",
//     methods: ["GET", "POST"],
//   },
// });

const io = new Server(server, {
  cors: {
    origin: process.env.CORS,
    methods: ["GET", "POST"],
  },
});

app.use(cors());

const rooms = {};
const roles = ["king", "knight", "theif", "innocent"];
const correct_scores = {
  king: 100,
  knight: 50,
  innocent: 25,
  theif: 0,
};
const incorrect_scores = {
  king: 100,
  knight: 0,
  innocent: 25,
  theif: 50,
};

const getRandomIndexes = (size) => {
  var arr = [];
  while (arr.length < 3) {
    var r = Math.floor(Math.random() * size);
    if (arr.indexOf(r) === -1) arr.push(r);
  }
  return arr;
};

io.on("connection", (socket) => {
  // user enters a room
  socket.on("login", (data) => {
    var user = {
      username: data.username,
      score: 0,
      id: socket.id,
      role: "",
      room: data.room,
    };

    // checking if room exists
    if (rooms[data.room]) {
      if (rooms[data.room].length >= 6) {
        socket.emit("error", "room is full");
        return;
      }
      if (rooms[data.room].find((x) => x.username === data.username)) {
        socket.emit("error", "username already exist in the room");
        return;
      }
      socket.join(data.room);
      rooms[data.room] = [...rooms[data.room], user];

      // creating new room
    } else {
      socket.join(data.room);
      rooms[data.room] = [user];
    }

    socket.emit("current_user", data);
    io.in(data.room).emit("users", rooms[data.room]);
  });

  // user sends a message in room
  socket.on("send_message", (data) => {
    io.in(data.room).emit("receive_message", data);
  });

  // user logs out
  socket.on("logout", (data) => {
    rooms[data.room] = rooms[data.room].filter(
      (x) => x.username !== data.username,
    );
    io.in(data.room).emit("users", rooms[data.room]);
    socket.emit("current_user", { username: null, room: null });
  });

  // assigned roles to every user
  socket.on("assign_roles", (data) => {
    // get 3 random values to pick random people
    var people = getRandomIndexes(rooms[data.room].length);

    // assigning roles to those random people
    people.forEach((x, i) => {
      rooms[data.room][x] = { ...rooms[data.room][x], role: roles[i] };
    });

    // assigning role to remaining people
    rooms[data.room] = rooms[data.room].map(
      (x, i) => (x = people.includes(i) ? x : { ...x, role: roles[3] }),
    );
    io.in(data.room).emit("get_roles", rooms[data.room]);
  });

  // user provided an answer
  socket.on("answer", (data) => {
    const correct = rooms[data.room].find(
      (x) => x.username === data.answer && x.role === "theif",
    );

    rooms[data.room] = correct
      ? rooms[data.room].map(
          (x) => (x = { ...x, score: x.score + correct_scores[x.role] }),
        )
      : rooms[data.room].map(
          (x) => (x = { ...x, score: x.score + incorrect_scores[x.role] }),
        );

    // send result of answer
    io.in(data.room).emit("result", { correct: correct, guess: data.answer });

    // sending user with updated scores
    io.in(data.room).emit("users", rooms[data.room]);
    socket.emit(
      "current_user",
      rooms[data.room].find((x) => x.username === data.username),
    );
  });
});

app.all("/", (req, res) => {
  res.send("Its hosted!");
});

server.listen(3001, () => {
  console.log("SERVER IS RUNNING");
});
