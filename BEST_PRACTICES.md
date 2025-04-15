# 🤖 Best Practices for UBC LLED Chatbot App

This document outlines recommended best practices for developing, deploying, and maintaining the UBC LLED chatbot, which uses OpenAI APIs and a custom frontend widget to provide public-facing academic support.

---

## 🛠 Project Structure

- `index.js`: Main Express server
- `api/chat.js`: Chat endpoint with embedding search
- `data/website_chunks.json`: Precomputed embeddings + metadata
- `public/chatbot.html`: Embeddable frontend widget
- `.env`: Environment variables (never commit this file)
- `package.json`: Project dependencies and scripts

---

## ✅ Development Best Practices

### 1. Use Environment Variables
- Store sensitive data like `OPENAI_API_KEY` in `.env`
- Access securely via `process.env` (use `dotenv`)

### 2. Use Embeddings Efficiently
- Precompute and cache embeddings from source content
- Store as JSON in `data/website_chunks.json`
- Limit size per chunk (~100–300 tokens) for precision
- Normalize vectors when storing to speed up cosine similarity

### 3. Optimize Vector Search
- Use in-memory filtering for small datasets
- For larger datasets, switch to a vector database (e.g., Pinecone, Weaviate)

### 4. Rate Limiting & Abuse Protection
- Add a basic rate limiter to prevent abuse
- Avoid exposing raw API keys on the frontend

### 5. Secure CORS
- Allow only your domain(s) in production (e.g., `https://lled.educ.ubc.ca`)
- Use wildcard `*` only during local development

---

## 💬 Chat UI Best Practices

### 1. Lightweight Frontend
- Pure HTML/CSS/JS, no dependencies
- Served via `/public/chatbot.html` for easy embedding

### 2. Usability
- Auto-scroll message box
- Placeholder prompt text
- Show typing indicator (`"Typing..."`)
- Gracefully handle errors

### 3. Customization
- Match LLED brand (colors, fonts)
- Easy to toggle widget visibility
- Embed via `<script>` or GTM

---

## 🚀 Deployment Guidelines

### 1. Hosting
- Recommend: [Vercel](https://vercel.com)
- Add build and runtime secrets (e.g., `OPENAI_API_KEY`)

### 2. Secure Your API
- Ensure chat endpoint is `POST` only
- Validate and sanitize user input
- Implement basic auth if needed (for admin features)

### 3. Logging & Monitoring
- Log failed requests and OpenAI API errors
- Monitor usage (rate, token cost, etc.)

---

## 🔐 OpenAI Best Practices

- Use `gpt-3.5-turbo` for fast, low-cost replies
- Cap `max_tokens` to prevent runaway costs
- Use `temperature: 0.3–0.7` for consistent but helpful tone
- Avoid excessive context length to reduce latency

---

## 🌍 SEO / Analytics

- Don't index chatbot UI with search engines
- Add event tracking (e.g., Google Analytics custom events) for usage metrics
- Optionally anonymize session data for analysis

---

## 🧪 Testing

- Unit test chat API logic (e.g., embedding search)
- Manually test frontend UI in:
  - Desktop Chrome, Safari
  - Mobile browsers (iOS/Android)
- Use fake input to simulate edge cases and abuse

---

## 🧼 Maintenance Tips

- Periodically re-embed source content (as LLED site changes)
- Rotate API keys if leaked
- Monitor OpenAI usage costs monthly
- Keep dependencies up-to-date with `npm audit` / `npm update`

---

## 📝 Attribution

This chatbot uses OpenAI GPT models and draws from publicly available content from [https://lled.educ.ubc.ca/](https://lled.educ.ubc.ca/).

---

## 🧑‍💻 Authors & Contributions

Maintained by the UBC LLED team