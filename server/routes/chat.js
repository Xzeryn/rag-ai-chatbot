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

    console.log('Elasticsearch index:', ELASTICSEARCH_INDEX);
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