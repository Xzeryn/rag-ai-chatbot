const express = require('express');
const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");

const router = express.Router();

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION,
});

router.post('/', async (req, res) => {
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
            content: message
          }
        ]
      }),
    };

    const command = new InvokeModelCommand(params);
    const response = await client.send(command);

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    res.json({ reply: responseBody.content[0].text });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'An error occurred while processing your request.' });
  }
});

module.exports = router;