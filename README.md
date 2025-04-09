# Creating a RAG AI Chatbot with React, Node.js, Vite, Amazon Bedrock (Claude 3.5 Sonnet), and Elasticsearch using Semantic Search

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
  npm install dompurify dotenv marked react-textarea-autosize rollup
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
    MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0
    BEDROCK_MAX_TOKENS=500
    BEDROCK_TEMPERATURE=0.7

    ELASTICSEARCH_URL=https://your-elasticsearch-url
    ELASTICSEARCH_API_KEY=your-api-key-here
    ELASTICSEARCH_INDEX=knowledge_base
    ELASTICSEARCH_CONTENT_FIELD=content
    ELASTICSEARCH_SEMANTIC_FIELD=semantic_content
    ELASTICSEARCH_ELSER_MODEL_ID=.elser_model_1
    ELASTICSEARCH_INFERENCE_ID=elser-sparse-embedding
    ELASTICSEARCH_TEST_QUERY="What is Elasticsearch? or something relevant to your data"
    ELASTICSEARCH_KEYWORD_MIN_SCORE=0.5
    ELASTICSEARCH_SEMANTIC_MIN_SCORE=0.5

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
  require('dotenv').config();

  const router = express.Router();

  const bedrockClient = new BedrockRuntimeClient({
    region: process.env.AWS_REGION,
  });

  // Load environment variables
  const PROMPT_TEMPLATE = process.env.PROMPT_TEMPLATE || "You are a helpful AI assistant. Use the following context to answer the user's question. If the context doesn't contain relevant information, use your general knowledge to provide a helpful response. Always format your response using Markdown for better readability.\n\nContext:\n{context}\n\nUser: {question}\n\nAssistant:"
  const MODEL_ID = process.env.MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0'
  const MAX_TOKENS = parseInt(process.env.BEDROCK_MAX_TOKENS, 10) || 500;
  const TEMPERATURE = parseFloat(process.env.BEDROCK_TEMPERATURE) || 0.7;
  const ELASTICSEARCH_INDEX = process.env.ELASTICSEARCH_INDEX || 'knowledge_base';
  const ELASTICSEARCH_CONTENT_FIELD = process.env.ELASTICSEARCH_CONTENT_FIELD || 'content';
  const ELASTICSEARCH_SEMANTIC_FIELD = process.env.ELASTICSEARCH_SEMANTIC_FIELD || 'semantic_content';
  const ELASTICSEARCH_ELSER_MODEL_ID = process.env.ELASTICSEARCH_ELSER_MODEL_ID || '.elser_model_1';
  const ELASTICSEARCH_TEST_QUERY = process.env.ELASTICSEARCH_TEST_QUERY || 'What is Elasticsearch?';
  const ELASTICSEARCH_KEYWORD_MIN_SCORE = parseFloat(process.env.ELASTICSEARCH_KEYWORD_MIN_SCORE) || 0.5;
  const ELASTICSEARCH_SEMANTIC_MIN_SCORE = parseFloat(process.env.ELASTICSEARCH_SEMANTIC_MIN_SCORE) || 0.5;

  // Diagnostic function to check Elasticsearch setup
  async function checkElasticsearchSetup() {
    try {
      const indexExists = await elasticsearchClient.indices.exists({ index: ELASTICSEARCH_INDEX });
      console.log(`Index ${ELASTICSEARCH_INDEX} exists:`, indexExists);

      if (indexExists) {
        const mapping = await elasticsearchClient.indices.getMapping({ index: ELASTICSEARCH_INDEX });
        console.log('Mapping exists:', !!mapping);
        console.log('Mapping has content:', mapping && Object.keys(mapping).length > 0);
        // console.log('Index mapping:', JSON.stringify(mapping, null, 2));

        const sampleDoc = await elasticsearchClient.search({
          index: ELASTICSEARCH_INDEX,
          body: { query: { match_all: {} }, size: 1 }
        });
        console.log('SampleDoc exists:', !!sampleDoc);
        console.log('SampleDoc has content:', sampleDoc && sampleDoc.hits && sampleDoc.hits.hits && sampleDoc.hits.hits.length > 0);
        // console.log('Sample document:', JSON.stringify(sampleDoc.hits.hits[0], null, 2));
      }

      // Check Elasticsearch version
      const info = await elasticsearchClient.info();
      console.log('Elasticsearch version:', info.version.number);

      // Check ELSER model status
      try {
        const modelInfo = await elasticsearchClient.ml.getTrainedModels({ model_id: ELASTICSEARCH_ELSER_MODEL_ID });
        console.log('ELSER model info:', JSON.stringify(modelInfo, null, 2));
      } catch (modelError) {
        console.error('Error checking ELSER model:', modelError);
      }

      // Perform a test search
      console.log('Performing test search...');
      const testResult = await searchElasticsearch(ELASTICSEARCH_TEST_QUERY);
      console.log('Test search result:', testResult ? 'SUCCESS ✅' : 'FAIL ❌');
      // Optional: Log the length of the result if successful
      if (testResult) {
        console.log(`Found ${testResult.length} characters of context data`);
      }

    } catch (error) {
      console.error('Error checking Elasticsearch setup:', error);
    }
  }

  // Call the diagnostic function
  checkElasticsearchSetup();

  async function searchElasticsearch(query) {
    try {
      const searchBody = {
        query: {
          bool: {
            should: [
              {
                function_score: {
                  query: {
                    match: {
                      [ELASTICSEARCH_CONTENT_FIELD]: query
                    }
                  },
                  min_score: ELASTICSEARCH_KEYWORD_MIN_SCORE
                }
              },
              {
                function_score: {
                  query: {
                    semantic: {
                      field: ELASTICSEARCH_SEMANTIC_FIELD,
                      query: query
                    }
                  },
                  min_score: ELASTICSEARCH_SEMANTIC_MIN_SCORE
                }
              }
            ]
          }
        }
      };

      console.log('Elasticsearch query:', JSON.stringify(searchBody, null, 2));

      const result = await elasticsearchClient.search({
        index: ELASTICSEARCH_INDEX,
        body: searchBody
      });

      console.log('Elasticsearch index:', ELASTICSEARCH_INDEX);
      console.log('Elasticsearch result hits:', result.hits.total.value);

      if (result.hits && result.hits.hits && result.hits.hits.length > 0) {
        // Log each hit's content for inspection
        console.log('Elasticsearch hits details:');
        result.hits.hits.forEach((hit, index) => {
          // console.log(`Hit ${index + 1} _source:`, JSON.stringify(hit._source, null, 2));
          
          // Get the content field, handling potential nested fields
          const contentValue = getNestedProperty(hit._source, ELASTICSEARCH_CONTENT_FIELD);
          console.log(`Hit ${index + 1} content field (${ELASTICSEARCH_CONTENT_FIELD}):`, 
            contentValue || 'FIELD NOT FOUND');
        });
        
        // Format each document as a JSON string with its metadata
        const contextString = result.hits.hits
          .map(hit => {
            // Create an object with document metadata and source
            const documentWithMetadata = {
              _id: hit._id,
              _score: hit._score,
              _index: hit._index,
              data: hit._source
            };
            
            // Format as a markdown code block with JSON
            return `\`\`\`json\n${JSON.stringify(documentWithMetadata, null, 2)}\n\`\`\``;
          })
          .join('\n\n');
          
        return contextString;
      } else {
        console.log('No hits found in Elasticsearch result');
        return '';
      }
    } catch (error) {
      console.error('Elasticsearch error:', error);
      if (error.meta && error.meta.body) {
        console.error('Elasticsearch error details:', error.meta.body.error);
      }
      return '';
    }
  }

  // Helper function to get nested properties using dot notation
  function getNestedProperty(obj, path) {
    // Handle direct property access first
    if (obj[path] !== undefined) {
      return obj[path];
    }
    
    // Handle nested properties
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length; i++) {
      if (current === undefined || current === null) {
        return undefined;
      }
      current = current[parts[i]];
    }
    
    return current;
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
      if (context && context.length > 0) {
        // Check if the context contains only whitespace characters
        if (context.trim() === '') {
          console.log('Warning: Context contains only whitespace characters');
        }
      }

      const formattedPrompt = PROMPT_TEMPLATE
        .replace('{context}', context)
        .replace('{question}', message);
      // console.log('Formatted Prompt:', formattedPrompt);

      const params = {
        modelId: MODEL_ID,
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
  import TextareaAutosize from 'react-textarea-autosize';

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
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!input.trim() || isLoading) return;

      const userMessage = { markdown: input, isUser: true };
      setMessages(prevMessages => [...prevMessages, userMessage]);
      setInput('');
      setIsLoading(true);

      try {
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }

        eventSourceRef.current = new EventSource(`http://localhost:5000/api/chat?message=${encodeURIComponent(input)}`);

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
        <div className="messages-container">
          <div className="messages">
            {messages.map((message, index) => (
              <Message key={index} markdown={message.markdown} isUser={message.isUser} />
            ))}
            {isLoading && <div className="message ai loading">AI is typing...</div>}
            <div ref={messagesEndRef} />
          </div>
        </div>
        <div className="input-container">
          <form onSubmit={handleSubmit} className="input-form">
            <TextareaAutosize
              minRows={2}
              maxRows={6}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              disabled={isLoading}
              className="chat-input"
            />
            <button type="submit" disabled={isLoading}>Send</button>
          </form>
        </div>
      </div>
    );
  };

  export default ChatInterface;
  ```

  `client/src/app.jsx`:

  ```jsx
  import { useState } from 'react'
  import reactLogo from './assets/react.svg'
  import viteLogo from '/vite.svg'
  import ChatInterface from './components/ChatInterface';
  import './App.css'

  function App() {
    const [count, setCount] = useState(0)

    return (
      <>
        <div>
          <a href="https://vite.dev" target="_blank">
            <img src={viteLogo} className="logo" alt="Vite logo" />
          </a>
          <a href="https://react.dev" target="_blank">
            <img src={reactLogo} className="logo react" alt="React logo" />
          </a>
        </div>
        <h1>AI Chatbot</h1>
        <div className="chat-container">
          <ChatInterface />
        </div>
        <p className="read-the-docs">
          Click on the Vite and React logos to learn more
        </p>
      </>
    )
  }

  export default App
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
  html, body, #root, .App {
    height: 100%;
    width: 100%;
    margin: 0;
    padding: 0;
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

  .App {
    display: flex;
    flex-direction: column;
    padding: 20px;
    box-sizing: border-box;
  }

  h1 {
    text-align: center;
    margin-bottom: 20px;
  }

  .chat-container {
    flex-grow: 1;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .chat-interface {
    width: 80%;
    height: 80vh;
    border: 1px solid #ccc;
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .messages-container {
    flex-grow: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .input-container {
    border-top: 1px solid #ccc;
    padding: 10px;
  }

  .input-form {
    display: flex;
    gap: 10px;
  }

  .chat-input {
    flex-grow: 1;
    padding: 10px;
    font-size: 16px;
    border: 1px solid #ccc;
    border-radius: 4px;
    resize: none;
  }

  button {
    padding: 10px 20px;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  button:disabled {
    background-color: #cccccc;
  }

  .message {
    margin-bottom: 10px;
    padding: 10px;
    border-radius: 8px;
    max-width: 100%;
  }

  .message.user {
    align-self: flex-end;
    background-color: #007bff;
    color: white;
  }

  .message.ai {
    align-self: flex-start;
    background-color: #f0f0f0;
    color: black;
  }

  .loading {
    font-style: italic;
    color: #888;
  }

  ```

10. Update `client/vite.config.js`

  ```js
  import { defineConfig } from 'vite'
  import react from '@vitejs/plugin-react'

  // https://vite.dev/config/
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
  require('dotenv').config();
  const client = require('./elasticsearchClient');

  // Load environment variables
  const ELASTICSEARCH_INDEX = process.env.ELASTICSEARCH_INDEX || 'knowledge_base';
  const ELASTICSEARCH_CONTENT_FIELD = process.env.ELASTICSEARCH_CONTENT_FIELD || 'content';
  const ELASTICSEARCH_SEMANTIC_FIELD = process.env.ELASTICSEARCH_SEMANTIC_FIELD || 'semantic_content';
  const INFERENCE_ID = process.env.ELASTICSEARCH_INFERENCE_ID || 'elser-sparse-embedding';

  async function createOrUpdateIndex() {
    const desiredMapping = {
      properties: {
        [ELASTICSEARCH_CONTENT_FIELD]: { 
          type: "text"
        },
        [ELASTICSEARCH_SEMANTIC_FIELD]: {
          type: "semantic_text",
          inference_id: INFERENCE_ID,
          model_settings: {
            task_type: "sparse_embedding"
          }
        }
      }
    };

    const indexExists = await client.indices.exists({ index: ELASTICSEARCH_INDEX });

    if (!indexExists) {
      try {
        await client.indices.create({
          index: ELASTICSEARCH_INDEX,
          body: {
            mappings: desiredMapping
          }
        });
        console.log('Index created successfully');
      } catch (error) {
        console.error('Error creating index:', error);
        throw error;
      }
    } else {
      try {
        const currentMapping = await client.indices.getMapping({ index: ELASTICSEARCH_INDEX });
        const currentProperties = currentMapping[ELASTICSEARCH_INDEX].mappings.properties;

        if (JSON.stringify(currentProperties) !== JSON.stringify(desiredMapping.properties)) {
          console.log('Existing mapping differs from desired mapping. Creating a new index...');
          const newIndexName = `${ELASTICSEARCH_INDEX}_${Date.now()}`;
          await client.indices.create({
            index: newIndexName,
            body: {
              mappings: desiredMapping
            }
          });
          console.log(`New index ${newIndexName} created successfully`);
          
          // Here you would typically reindex data from the old index to the new one
          // and update aliases if you're using them.
          console.log('Remember to reindex your data to the new index and update any aliases!');
          
          // Update the ELASTICSEARCH_INDEX to use the new index name
          process.env.ELASTICSEARCH_INDEX = newIndexName;
        } else {
          console.log('Existing mapping matches desired mapping. No changes needed.');
        }
      } catch (error) {
        console.error('Error checking or updating index:', error);
        throw error;
      }
    }
  }

  async function indexDocuments() {
    try {
      await createOrUpdateIndex();

      const documents = [
        { id: 1, content: "Elasticsearch is a distributed search and analytics engine." },
        { id: 2, content: "Retrieval Augmented Generation enhances AI responses with relevant context." },
        { id: 3, content: "Vector search enables semantic similarity comparisons in high-dimensional spaces." },
        { id: 4, content: "Embeddings are dense vector representations of text or other data types." },
        { id: 5, content: "Cosine similarity is a measure of similarity between two non-zero vectors." }
      ];

      for (const doc of documents) {
        try {
          const result = await client.index({
            index: process.env.ELASTICSEARCH_INDEX,
            id: doc.id.toString(),
            body: {
              [ELASTICSEARCH_CONTENT_FIELD]: doc.content,
              [ELASTICSEARCH_SEMANTIC_FIELD]: doc.content
            }
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
