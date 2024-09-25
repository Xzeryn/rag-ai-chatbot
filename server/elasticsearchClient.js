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