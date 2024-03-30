'use client';
import { useState } from 'react';
import useCsrfTokenHeader from 'src/app/core/hooks/use-csrf-token-header'; // 引入CSRF令牌hook

interface SearchResult {
  title: string;
  abstract: string;
  link: string;
}

function ChatPage() {
  const [question, setQuestion] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [answer, setAnswer] = useState('');
  const csrfTokenHeader = useCsrfTokenHeader(); // 使用hook获取CSRF令牌头

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // 准备发送的新消息，此处假设存在messages状态和一个表示新消息的newMessage变量
    const newMessage = { role: 'user', content: question }; // 示例新消息对象

    const response = await fetch('/api/chatbot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...csrfTokenHeader, // 附加CSRF令牌到请求头
      },
      body: JSON.stringify({ messages: [newMessage] }), // 更新请求体以包含消息数组
    });

    const data = await response.json();
    setSearchResults(data.searchResults); // 假设后端返回的数据包含searchResults字段
    setAnswer(data.answer); // 假设后端返回的数据包含answer字段
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button type="submit">Send</button>
      </form>

      <h2>User Question:</h2>
      <p>{question}</p>

      <h2>Search Results:</h2>
      <ul>
        {searchResults.map((result, index) => (
          <li key={index}>
            <h3>{result.title}</h3>
            <p>{result.abstract}</p>
            <a href={result.link} target="_blank" rel="noopener noreferrer">
              {result.link}
            </a>
          </li>
        ))}
      </ul>

      <h2>Answer:</h2>
      <p>{answer}</p>
    </div>
  );
}

export default ChatPage;
