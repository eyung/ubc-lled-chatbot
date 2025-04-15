// index.js
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const chatRouter = require("./api/chat");

const app = express();
const PORT = process.env.PORT || 3000;

// Configure CORS for different environments
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? ['https://lled.educ.ubc.ca'] // Add your production domain
    : '*',
  methods: ['POST'], // Restrict to POST requests only
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(express.static("public"));

app.use("/api", chatRouter);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
