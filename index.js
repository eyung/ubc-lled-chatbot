// index.js
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
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

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Root route redirects to chatbot
app.get('/', (req, res) => {
  res.redirect('/chatbot');
});

// Explicit route for chatbot
app.get('/chatbot', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chatbot.html'));
});

app.use("/api", chatRouter);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
