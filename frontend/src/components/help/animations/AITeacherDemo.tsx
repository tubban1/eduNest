'use client';

import React, { useState } from 'react';

export default function AITeacherDemo() {
  const [showAvatar, setShowAvatar] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [messages, setMessages] = useState<Array<{ text: string; type: 'ai' | 'user' }>>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const typeMessage = (text: string, callback: () => void) => {
    setIsTyping(true);
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        i++;
      } else {
        clearInterval(interval);
        setIsTyping(false);
        callback();
      }
    }, 30);
  };

  const handleButtonClick = () => {
    setShowDialog(true);
    if (messages.length === 0) {
      const welcomeText = 'Hello! I am your AI Teacher. How can I help you learn today?';
      typeMessage(welcomeText, () => {
        setMessages([{ text: welcomeText, type: 'ai' }]);
      });
    }
  };

  const handleSend = () => {
    if (!inputValue.trim() || isTyping) return;

    const userMessage = inputValue.trim();
    setMessages(prev => [...prev, { text: userMessage, type: 'user' }]);
    setInputValue('');

    setTimeout(() => {
      const responseText = 'That is a great question! I am here to help you learn.';
      typeMessage(responseText, () => {
        setMessages(prev => [...prev, { text: responseText, type: 'ai' }]);
      });
    }, 500);
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-white p-4 rounded-lg border-2 border-purple-500 relative">
      <div className="relative w-full h-64 bg-gradient-to-br from-purple-500 to-purple-700 rounded-lg overflow-hidden">
        {/* AI Teacher Avatar */}
        {showAvatar && (
          <div
            className="absolute bottom-20 right-5 w-16 h-16 bg-gradient-to-br from-pink-400 to-pink-600 rounded-full flex items-center justify-center text-3xl shadow-lg animate-[popIn_0.3s_ease-out]"
            style={{
              animation: 'popIn 0.3s ease-out'
            }}
          >
            🤖
          </div>
        )}

        {/* AI Teacher Button */}
        <button
          onMouseEnter={() => setShowAvatar(true)}
          onMouseLeave={() => setShowAvatar(false)}
          onClick={handleButtonClick}
          className="absolute bottom-5 right-5 bg-blue-500 text-white px-5 py-3 rounded-full flex items-center gap-2 shadow-lg hover:bg-blue-600 active:bg-blue-700 transition-all touch-manipulation"
          style={{ minWidth: '44px', minHeight: '44px' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span>AI Teacher</span>
        </button>
      </div>

      {/* Dialog Overlay - 相对于当前容器定位 */}
      {showDialog && (
        <div
          className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 animate-[fadeIn_0.3s_ease-out] rounded-lg"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDialog(false);
            }
          }}
        >
          <div className="bg-white rounded-xl w-11/12 max-w-lg max-h-[80vh] overflow-hidden shadow-2xl animate-[popOpen_0.5s_cubic-bezier(0.68,-0.55,0.265,1.55)]">
            {/* Dialog Header */}
            <div className="bg-gradient-to-r from-purple-500 to-purple-700 text-white p-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <span>🤖</span>
                <span>AI Teacher</span>
              </h3>
              <button
                onClick={() => setShowDialog(false)}
                className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors touch-manipulation"
                style={{ minWidth: '44px', minHeight: '44px' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Dialog Content */}
            <div className="p-5 max-h-[calc(80vh-140px)] overflow-y-auto">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`mb-3 p-3 rounded-lg ${
                    msg.type === 'user'
                      ? 'bg-blue-500 text-white ml-auto max-w-[80%]'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {msg.text}
                  {isTyping && idx === messages.length - 1 && msg.type === 'ai' && (
                    <span className="inline-block w-2 h-4 bg-gray-800 ml-1 animate-[blink_1s_infinite]" />
                  )}
                </div>
              ))}
            </div>

            {/* Dialog Input */}
            <div className="flex gap-2 p-5 border-t border-gray-200">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !isTyping) {
                    handleSend();
                  }
                }}
                placeholder="Ask a question..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-base"
                style={{ minHeight: '44px' }}
              />
              <button
                onClick={handleSend}
                disabled={isTyping || !inputValue.trim()}
                className="px-5 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 active:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors touch-manipulation"
                style={{ minWidth: '44px', minHeight: '44px' }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes popIn {
          from {
            transform: scale(0) translateY(20px);
            opacity: 0;
          }
          to {
            transform: scale(1) translateY(0);
            opacity: 1;
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes popOpen {
          0% {
            transform: scale(0.3) translateY(50px);
            opacity: 0;
          }
          50% {
            transform: scale(1.05) translateY(-5px);
          }
          100% {
            transform: scale(1) translateY(0);
            opacity: 1;
          }
        }
        @keyframes blink {
          0%, 50% {
            opacity: 1;
          }
          51%, 100% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

