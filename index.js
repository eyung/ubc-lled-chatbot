// index.js
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const chatRouter = require("./api/chat");

const app = express();

// Configure CORS for different environments
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? ['https://lled.educ.ubc.ca'] // Add your production domain
    : '*',
  methods: ['POST', 'GET', 'OPTIONS'], // Allow GET for static files
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(bodyParser.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Root route redirects to chatbot-iframe
app.get('/', (req, res) => {
  res.redirect('/chatbot');
});

// Explicit routes for chatbot
app.get('/chatbot', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chatbot-iframe.html'));
});

app.get('/chatbot-iframe', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chatbot-iframe.html'));
});

// API routes
app.use("/api", chatRouter);

// Handle 404s
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', 'chatbot-iframe.html'));
});

// For local development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

// Export for Vercel
module.exports = app;
