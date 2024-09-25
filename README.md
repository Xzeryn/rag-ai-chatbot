# Creating a RAG AI Chatbot with React, Node.js, Vite, Amazon Bedrock (Claude 3.5 Sonnet), and Elasticsearch

## Directory Structure

```
ai-chatbot/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatInterface.jsx
│   │   │   └── Message.jsx
│   │   ├── App.css
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── server/
│   ├── routes/
│   │   └── chat.js
│   ├── .env
│   ├── elasticsearchClient.js
│   ├── indexDocuments.js
|   ├── package.json
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
  npm install dompurify marked
  ```

3. Set up the server (Node.js):

  ```bash
  cd ../server
  npm init -y
  npm install express cors dotenv marked @aws-sdk/client-bedrock-runtime @elastic/elasticsearch
  ```

4. Configure Amazon Bedrock and Elasticsearch:

  - Sign up for an AWS account if you don't have one
  - Set up Amazon Bedrock and obtain the necessary API keys
  - Set up an Elasticsearch cluster and obtain the necessary API keys
  - Create a `.env` file in the `server` directory:

    ```
    AWS_ACCESS_KEY_ID=your_access_key
    AWS_SECRET_ACCESS_KEY=your_secret_key
    AWS_REGION=your_region
    BEDROCK_MAX_TOKENS=500
    BEDROCK_TEMPERATURE=0.7

    ELASTICSEARCH_URL=https://your-elasticsearch-url
    ELASTICSEARCH_API_KEY=your-api-key-here
    ELASTICSEARCH_INDEX=knowledge_base

    PROMPT_TEMPLATE="You are a helpful AI assistant. Use the following context to answer the user's question. If the context doesn't contain relevant information, use your general knowledge to provide a helpful response. Always format your response using Markdown for better readability.\n\nContext:\n{context}\n\nUser: {question}\n\nAssistant:"
    ```

5. Create the server (`server/server.js`):

  ```javascript
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
  ```

6. Create the Elasticsearch client (`server/elasticsearchClient.js`):
 
  ```javascript
  const { Client } = require('@elastic/elasticsearch');
  require('dotenv').config();

  const client = new Client({
    node: process.env.ELASTICSEARCH_URL,
    auth: {
      apiKey: process.env.ELASTICSEARCH_API_KEY
    },
    tls: {
      rejectUnauthorized: false // Only use this for testing. In production, use proper SSL certificates.
    }
  });

  // Test the connection
  client.ping()
    .then(() => console.log('Connected to Elasticsearch'))
    .catch(error => console.error('Elasticsearch connection error:', error));

  module.exports = client;
  ```

7. Create the chat route (`server/routes/chat.js`):

  ```javascript
  const express = require('express');
  const { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand } = require("@aws-sdk/client-bedrock-runtime");
  const elasticsearchClient = require('../elasticsearchClient');
  const { marked } = require('marked');

  const router = express.Router();

  const bedrockClient = new BedrockRuntimeClient({
    region: process.env.AWS_REGION,
  });

  // Load environment variables
  const PROMPT_TEMPLATE = process.env.PROMPT_TEMPLATE || "You are a helpful AI assistant. Use the following context to answer the user's question. If the context doesn't contain relevant information, use your general knowledge to provide a helpful response. Always format your response using Markdown for better readability.\n\nContext:\n{context}\n\nUser: {question}\n\nAssistant:"
  const MAX_TOKENS = parseInt(process.env.BEDROCK_MAX_TOKENS, 10) || 500; // Default to 500 if not set
  const TEMPERATURE = parseFloat(process.env.BEDROCK_TEMPERATURE) || 0.7; // Default to 0.7 if not set
  const ELASTICSEARCH_INDEX = process.env.ELASTICSEARCH_INDEX || 'knowledge_base'; // Default to 'knowledge_base' if not set

  async function searchElasticsearch(query) {
    try {
      const result = await elasticsearchClient.search({
        index: ELASTICSEARCH_INDEX,
        body: {
          query: {
            match: {
              content: query
            }
          }
        }
      });

      console.log('Elasticsearch result:', JSON.stringify(result, null, 2));

      if (result && result.hits && result.hits.hits) {
        return result.hits.hits.map(hit => hit._source.content).join(' ');
      } else {
        console.log('No hits found in Elasticsearch result');
        return '';
      }
    } catch (error) {
      console.error('Elasticsearch error:', error);
      return '';
    }
  }

  router.get('/', async (req, res) => {
    console.log('Received GET request to /api/chat');
    const message = req.query.message;
    console.log('Received message:', message);

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    try {
      const context = await searchElasticsearch(message);

      // Use the prompt template to format the message
      const formattedPrompt = PROMPT_TEMPLATE
        .replace('{context}', context)
        .replace('{question}', message);
      console.log('Formatted Prompt:', formattedPrompt);

      const params = {
        modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: MAX_TOKENS,
          temperature: TEMPERATURE,
          messages: [
            {
              role: "user",
              content: formattedPrompt
            }
          ]
        }),
      };
      
      console.log('Bedrock params:', JSON.stringify(params, null, 2));
      
      const command = new InvokeModelWithResponseStreamCommand(params);
      const response = await bedrockClient.send(command);

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });

      let fullResponse = '';

      for await (const chunk of response.body) {
        if (chunk.chunk && chunk.chunk.bytes) {
          const decodedChunk = new TextDecoder().decode(chunk.chunk.bytes);
          // console.log('Decoded chunk:', decodedChunk);
          try {
            const parsedChunk = JSON.parse(decodedChunk);
            if (parsedChunk.type === 'content_block_delta' && parsedChunk.delta && parsedChunk.delta.text) {
              fullResponse += parsedChunk.delta.text;
              res.write(`data: ${JSON.stringify({ text: parsedChunk.delta.text })}\n\n`);
            }
          } catch (parseError) {
            console.error('Error parsing chunk:', parseError);
          }
        }
      }

      res.write(`data: [DONE]\n\n`);
      res.end();

      // console.log('Full response:', fullResponse);
    } catch (error) {
      console.error('Error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'An error occurred while processing your request.' });
      } else {
        res.write(`data: ${JSON.stringify({ error: 'An error occurred while processing your request.' })}\n\n`);
        res.end();
      }
    }
  });

  module.exports = router;
  ```

8. Create the React components:

  `client/src/components/Message.jsx`:

  ```jsx
  const Message = ({ text, isUser }) => (
    <div className={`message ${isUser ? 'user' : 'bot'}`}>
      <p>{text}</p>
    </div>
  );
  
  export default Message;
  ```

  `client/src/components/ChatInterface.jsx`:

  ```jsx
  import React, { useState, useEffect, useRef } from 'react';
  import DOMPurify from 'dompurify';
  import { marked } from 'marked';

  const Message = ({ markdown, isUser }) => (
    <div className={`message ${isUser ? 'user' : 'ai'}`}>
      {isUser ? (
        <p>{markdown}</p>
      ) : (
        <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked(markdown)) }} />
      )}
    </div>
  );

  const ChatInterface = () => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const eventSourceRef = useRef(null);
    const latestMessageRef = useRef('');

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!input.trim() || isLoading) return;

      const userMessage = { markdown: input, isUser: true };
      setMessages(prevMessages => [...prevMessages, userMessage]);
      setInput('');
      setIsLoading(true);

      try {
        // Close any existing EventSource
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }

        // Create a new EventSource for this request
        eventSourceRef.current = new EventSource(`http://localhost:5000/api/chat?message=${encodeURIComponent(input)}`);

        // Add an initial bot message that will be updated
        setMessages(prevMessages => [...prevMessages, { markdown: '', isUser: false }]);
        latestMessageRef.current = '';

        eventSourceRef.current.onmessage = (event) => {
          if (event.data === '[DONE]') {
            eventSourceRef.current.close();
            setIsLoading(false);
          } else {
            try {
              const data = JSON.parse(event.data);
              if (data.text) {
                latestMessageRef.current += data.text;
                setMessages(prevMessages => {
                  const newMessages = [...prevMessages];
                  newMessages[newMessages.length - 1] = { markdown: latestMessageRef.current, isUser: false };
                  return newMessages;
                });
              } else if (data.error) {
                setMessages(prevMessages => [...prevMessages, { markdown: data.error, isUser: false }]);
                eventSourceRef.current.close();
                setIsLoading(false);
              }
            } catch (error) {
              console.error('Error parsing message:', error);
            }
          }
        };

        eventSourceRef.current.onerror = (error) => {
          console.error('EventSource failed:', error);
          eventSourceRef.current.close();
          setIsLoading(false);
          setMessages(prevMessages => [...prevMessages, { markdown: "An error occurred. Please try again.", isUser: false }]);
        };

      } catch (error) {
        console.error('Error:', error);
        setMessages(prevMessages => [...prevMessages, { markdown: "An error occurred. Please try again.", isUser: false }]);
        setIsLoading(false);
      }
    };

    useEffect(() => {
      return () => {
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }
      };
    }, []);

    return (
      <div className="chat-interface">
        <div className="messages">
          {messages.map((message, index) => (
            <Message key={index} markdown={message.markdown} isUser={message.isUser} />
          ))}
          {isLoading && <div className="loading">AI is typing...</div>}
        </div>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading}>Send</button>
        </form>
      </div>
    );
  };

  export default ChatInterface;
  ```

  `client/src/app.jsx`:

  ```jsx
  import ChatInterface from './components/ChatInterface';

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

  `client/src/main.jsx`:

  ```jsx
  import { StrictMode } from 'react'
  import { createRoot } from 'react-dom/client'
  import App from './App.jsx'
  import './index.css'

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  ```

  `client/src/App.css`:

  ```css
  #root {
    max-width: 1280px;
    margin: 0 auto;
    padding: 2rem;
    text-align: center;
  }

  .logo {
    height: 6em;
    padding: 1.5em;
    will-change: filter;
    transition: filter 300ms;
  }
  .logo:hover {
    filter: drop-shadow(0 0 2em #646cffaa);
  }
  .logo.react:hover {
    filter: drop-shadow(0 0 2em #61dafbaa);
  }

  @keyframes logo-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    a:nth-of-type(2) .logo {
      animation: logo-spin infinite 20s linear;
    }
  }

  .card {
    padding: 2em;
  }

  .read-the-docs {
    color: #888;
  }

  .message.ai {
    /* Styles for AI messages */
  }

  .message.ai h1, .message.ai h2, .message.ai h3, .message.ai h4, .message.ai h5, .message.ai h6 {
    margin-top: 1em;
    margin-bottom: 0.5em;
  }

  .message.ai p {
    margin-bottom: 1em;
  }

  .message.ai ul, .message.ai ol {
    margin-bottom: 1em;
    padding-left: 2em;
  }

  .message.ai li {
    margin-bottom: 0.5em;
  }

  .message.ai pre {
    background-color: #f4f4f4;
    padding: 1em;
    border-radius: 4px;
    overflow-x: auto;
  }

  .message.ai code {
    background-color: #f4f4f4;
    padding: 0.2em 0.4em;
    border-radius: 3px;
  }

  .message.ai blockquote {
    border-left: 4px solid #ccc;
    margin: 1em 0;
    padding-left: 1em;
    color: #666;
  }
  ```

10. Update `client/vite.config.js`

  ```js
  import { defineConfig } from 'vite'
  import react from '@vitejs/plugin-react'

  // https://vitejs.dev/config/
  export default defineConfig({
    plugins: [react()],
    server: {
      host: true
    }
  })
  ```

11. Index your documents (if not already done):
  Here's a script to index documents (`indexDocuments.js`):

  ```javascript
  const client = require('./elasticsearchClient');

  // Load environment variables
  const ELASTICSEARCH_INDEX = process.env.ELASTICSEARCH_INDEX || 'knowledge_base'; // Default to 'knowledge_base' if not set

  async function indexDocuments() {
    try {
      const documents = [
        { id: 1, content: "Elasticsearch is a distributed search and analytics engine." },
        { id: 2, content: "Retrieval Augmented Generation enhances AI responses with relevant context." },
      ];

      try {
        await client.indices.create({
          index: ELASTICSEARCH_INDEX
        });
        console.log('Index created successfully');
      } catch (error) {
        if (error.meta && error.meta.statusCode === 400 && error.body.error.type === 'resource_already_exists_exception') {
          console.log('Index already exists');
        } else {
          console.error('Error creating index:', error);
          return;
        }
      }

      for (const doc of documents) {
        try {
          const result = await client.index({
            index: ELASTICSEARCH_INDEX,
            body: doc
          });
          console.log(`Indexed document ${doc.id}:`, result);
        } catch (error) {
          console.error(`Error indexing document ${doc.id}:`, error);
          if (error.meta && error.meta.body) {
            console.error('Error details:', error.meta.body.error);
          }
        }
      }

      console.log('Indexing complete');
    } catch (error) {
      console.error('Error in indexing process:', error);
    }
  }

  indexDocuments().catch(console.error);
  ```

  Run this script to index your documents:
  ```bash
  node indexDocuments.js
  ```

12. Start the server:

  ```bash
  cd server
  node server.js
  ```

13. Start the client:

  ```bash
  cd client
  npm run dev
  ```

14. Open your browser and navigate to `http://localhost:5173` to use your AI chatbot.

Remember to handle errors, add proper styling, and implement additional features as needed for a production-ready application.

This markdown-formatted guide provides a comprehensive set of instructions for creating an AI chatbot using React, Node.js, Vite, and Amazon Bedrock with Claude 3.5 Sonnet. It includes the directory structure and step-by-step instructions for setting up both the client and server sides of the application.
