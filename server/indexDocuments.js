// This script does the following:
// 1. If the index doesn't exist, it creates it with the desired mapping.
// 2. If the index exists, it compares the current mapping with the desired mapping.
// 3. If the mappings differ, it creates a new index with a timestamp appended to the name.
// 4. It logs a reminder to reindex data and update aliases if necessary.
// 5. If a new index is created, it updates the ELASTICSEARCH_INDEX environment variable to use the new index name for subsequent operations.
//
// This approach avoids the need to update existing mappings, which can be problematic, especially for fields like semantic_text. Instead, it creates a new index when changes are needed, allowing you to reindex your data to the new structure.
//
// Remember that if you're using index aliases in your production setup, you'll need to add logic to update the aliases to point to the new index after reindexing your data.


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