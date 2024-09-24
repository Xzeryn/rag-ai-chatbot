const Message = ({ text, isUser }) => (
    <div className={`message ${isUser ? 'user' : 'bot'}`}>
      <p>{text}</p>
    </div>
  );
  
  export default Message;