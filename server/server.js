const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const chatRouter = require('./routes/chat');

dotenv.config();

const app = express();
app.use(cors({
  origin: 'http://localhost:5173', // or wherever your React app is served from
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

app.get('/', (req, res) => {
    res.send('AI Chatbot Server is running');
  });

app.use('/api/chat', chatRouter);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));