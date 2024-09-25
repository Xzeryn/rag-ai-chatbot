import React from 'react';
import ChatInterface from './components/ChatInterface';
import './App.css';

function App() {
  return (
    <div className="App">
      <h1>AI Chatbot</h1>
      <div className="chat-container">
        <ChatInterface />
      </div>
    </div>
  );
}

export default App;