import { useState, useRef } from 'react';

export const ChatInput = ({ onSend, disabled, onFileUpload, showUploadHint }) => {
  const [message, setMessage] = useState('');
  const fileInputRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message);
      setMessage('');
    }
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && onFileUpload) {
      onFileUpload(file);
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        onChange={handleFileChange}
        className="hidden"
      />
      <form onSubmit={handleSubmit} className="w-full">
        <div className="flex items-center bg-white rounded-full px-3 py-2.5 shadow-lg">
          <button
            type="button"
            onClick={handleFileClick}
            disabled={disabled}
            className={`text-gray-500 hover:text-gray-700 disabled:opacity-50 mr-2 flex-shrink-0 ${showUploadHint ? 'animate-pulse' : ''}`}
            title="Прикрепить файл"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ваши пожелания"
            className="flex-1 px-2 py-1.5 bg-transparent border-none outline-none text-gray-900 placeholder-gray-400 text-sm"
            disabled={disabled}
          />
          <button
            type="submit"
            disabled={disabled || !message.trim()}
            className="bg-blue-600 text-white w-9 h-9 rounded-full flex items-center justify-center hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors ml-2 flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </form>
    </>
  );
};


