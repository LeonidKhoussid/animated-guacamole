export const ChatMessages = ({ messages }) => {
  return (
    <div className="flex-1 overflow-y-auto space-y-4">
      {messages.map((msg, index) => (
        <div
          key={index}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[85%] rounded-3xl p-4 ${
              msg.role === 'user'
                ? 'bg-blue-500 text-white rounded-br-none'
                : 'bg-white text-gray-900 rounded-bl-none shadow-lg'
            }`}
          >
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
            {msg.variants && msg.variants.length > 0 && (
              <div className="mt-3 space-y-2">
                {msg.variants.map((variant) => (
                  <div key={variant.id} className={`rounded-xl p-3 ${
                    msg.role === 'user' 
                      ? 'bg-white bg-opacity-20' 
                      : 'bg-blue-50'
                  }`}>
                    <p className="font-semibold text-sm">{variant.description}</p>
                    <p className="text-xs mt-1 opacity-80">Вероятность одобрения: {Math.round(variant.approvalProbability * 100)}%</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};


