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
const MAX_TOKENS = parseInt(process.env.BEDROCK_MAX_TOKENS, 10) || 500;
const TEMPERATURE = parseFloat(process.env.BEDROCK_TEMPERATURE) || 0.7;
const ELASTICSEARCH_INDEX = process.env.ELASTICSEARCH_INDEX || 'knowledge_base';
const ELASTICSEARCH_CONTENT_FIELD = process.env.ELASTICSEARCH_CONTENT_FIELD || 'content';
const ELASTICSEARCH_SEMANTIC_FIELD = process.env.ELASTICSEARCH_SEMANTIC_FIELD || 'semantic_content';

// Diagnostic function to check Elasticsearch setup
async function checkElasticsearchSetup() {
  try {
    const indexExists = await elasticsearchClient.indices.exists({ index: ELASTICSEARCH_INDEX });
    console.log(`Index ${ELASTICSEARCH_INDEX} exists:`, indexExists);

    if (indexExists) {
      const mapping = await elasticsearchClient.indices.getMapping({ index: ELASTICSEARCH_INDEX });
      console.log('Index mapping:', JSON.stringify(mapping, null, 2));

      const sampleDoc = await elasticsearchClient.search({
        index: ELASTICSEARCH_INDEX,
        body: { query: { match_all: {} }, size: 1 }
      });
      console.log('Sample document:', JSON.stringify(sampleDoc.hits.hits[0], null, 2));
    }

    // Check Elasticsearch version
    const info = await elasticsearchClient.info();
    console.log('Elasticsearch version:', info.version.number);

    // Check ELSER model status
    try {
      const modelInfo = await elasticsearchClient.ml.getTrainedModels({ model_id: ".elser_model_1" });
      console.log('ELSER model info:', JSON.stringify(modelInfo, null, 2));
    } catch (modelError) {
      console.error('Error checking ELSER model:', modelError);
    }

    // Perform a test search
    console.log('Performing test search...');
    const testQuery = 'elasticsearch';
    const testResult = await searchElasticsearch(testQuery);
    console.log('Test search result:', testResult);

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
            { match: { [ELASTICSEARCH_CONTENT_FIELD]: query } },
            {
              semantic: {
                field: ELASTICSEARCH_SEMANTIC_FIELD,
                query: query,
                boost: 2  // Give more weight to semantic search
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
      return result.hits.hits.map(hit => hit._source[ELASTICSEARCH_CONTENT_FIELD]).join('\n\n');
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

router.get('/', async (req, res) => {
  console.log('Received GET request to /api/chat');
  const message = req.query.message;
  console.log('Received message:', message);

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const context = await searchElasticsearch(message);

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