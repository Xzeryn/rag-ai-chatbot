AI Chatbot

Write me step by step instructions to create a new AI chatbot using React, Node.js, Vite and amazon bedrock using api keys and using the Claude 3.5 Sonnet. Include a directory structure. Display in markdown

Here are step-by-step instructions to create a new AI chatbot using React, Node.js, Vite, Amazon Bedrock, and Claude 3.5 Sonnet, presented in markdown format:

# Creating an AI Chatbot with React, Node.js, Vite, and Amazon Bedrock (Claude 3.5 Sonnet)

## Directory Structure

```
ai-chatbot/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatInterface.jsx
│   │   │   └── Message.jsx
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── server/
│   ├── routes/
│   │   └── chat.js
│   ├── .env
│   ├── package.json
│   └── server.js
└── README.md
```

## Step-by-step Instructions

1. Set up the project structure:

  ```bash
  mkdir ai-chatbot
  cd ai-chatbot
  mkdir client server
  ```

2. Set up the client (React + Vite):

  ```bash
  cd client
  npm create vite@latest . -- --template react
  npm install axios
  ```

3. Set up the server (Node.js):

  ```bash
  cd ../server
  npm init -y
  npm install express cors dotenv @aws-sdk/client-bedrock-runtime
  ```

4. Configure Amazon Bedrock:

  - Sign up for an AWS account if you don't have one
  - Set up Amazon Bedrock and obtain the necessary API keys
  - Create a `.env` file in the `server` directory:

    ```
    AWS_ACCESS_KEY_ID=your_access_key
    AWS_SECRET_ACCESS_KEY=your_secret_key
    AWS_REGION=your_region
    ```

5. Create the server (`server/server.js`):

  ```javascript
  const express = require("express");
  const cors = require("cors");
  const dotenv = require("dotenv");
  const chatRouter = require("./routes/chat");

  dotenv.config();

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/", (req, res) => {
    res.send("AI Chatbot Server is running");
  });

  app.use("/api/chat", chatRouter);

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  ```

6. Create the chat route (`server/routes/chat.js`):

  ```javascript
  const express = require("express");
  const {
    BedrockRuntimeClient,
    InvokeModelCommand,
  } = require("@aws-sdk/client-bedrock-runtime");

  const router = express.Router();

  const client = new BedrockRuntimeClient({
    region: process.env.AWS_REGION,
  });

  router.post("/", async (req, res) => {
    try {
      const { message } = req.body;

      const params = {
        modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: message,
            },
          ],
        }),
      };

      const command = new InvokeModelCommand(params);
      const response = await client.send(command);

      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      res.json({ reply: responseBody.content[0].text });
    } catch (error) {
      console.error("Error:", error);
      res
        .status(500)
        .json({ error: "An error occurred while processing your request." });
    }
  });

  module.exports = router;
  ```

7. Create the React components:

  `client/src/components/Message.jsx`:

  ```jsx
  const Message = ({ text, isUser }) => (
    <div className={`message ${isUser ? "user" : "bot"}`}>
      <p>{text}</p>
    </div>
  );

  export default Message;
  ```

  `client/src/components/ChatInterface.jsx`:

  ```jsx
  import { useState } from "react";
  import axios from "axios";
  import Message from "./Message";

  const ChatInterface = () => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!input.trim()) return;

      const userMessage = { text: input, isUser: true };
      setMessages([...messages, userMessage]);
      setInput("");

      try {
        const response = await axios.post("http://localhost:5000/api/chat", {
          message: input,
        });
        const botMessage = { text: response.data.reply, isUser: false };
        setMessages((prevMessages) => [...prevMessages, botMessage]);
      } catch (error) {
        console.error("Error:", error);
      }
    };

    return (
      <div className="chat-interface">
        <div className="messages">
          {messages.map((message, index) => (
            <Message key={index} text={message.text} isUser={message.isUser} />
          ))}
        </div>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
          />
          <button type="submit">Send</button>
        </form>
      </div>
    );
  };

  export default ChatInterface;
  ```

8. Update `client/src/App.jsx`:

  ```jsx
  import ChatInterface from "./components/ChatInterface";

  function App() {
    return (
      <div className="App">
        <h1>AI Chatbot</h1>
        <ChatInterface />
      </div>
    );
  }

  export default App;
  ```

9. Update `client/vite.config.js`

  ```js
  import { defineConfig } from "vite";
  import react from "@vitejs/plugin-react";

  // https://vitejs.dev/config/
  export default defineConfig({
    plugins: [react()],
    server: {
      host: true,
    },
  });
  ```

10. Start the server:

  ```bash
  cd server
  node server.js
  ```

11. Start the client:

  ```bash
  cd client
  npm run dev
  ```

12. Open your browser and navigate to `http://localhost:5173` to use your AI chatbot.

Remember to handle errors, add proper styling, and implement additional features as needed for a production-ready application.

This markdown-formatted guide provides a comprehensive set of instructions for creating an AI chatbot using React, Node.js, Vite, and Amazon Bedrock with Claude 3.5 Sonnet. It includes the directory structure and step-by-step instructions for setting up both the client and server sides of the application.
