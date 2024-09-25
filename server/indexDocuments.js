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