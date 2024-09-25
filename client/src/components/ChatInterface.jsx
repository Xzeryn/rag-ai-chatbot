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