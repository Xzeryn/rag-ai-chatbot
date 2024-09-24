const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");
require('dotenv').config();

async function testBedrock() {
  const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION });

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
          content: "Hello, Claude!"
        }
      ]
    }),
  };

  try {
    const command = new InvokeModelCommand(params);
    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    console.log('Bedrock response:', responseBody);
  } catch (error) {
    console.error('Bedrock error:', error);
  }
}

testBedrock();