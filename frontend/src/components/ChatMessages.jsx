export const ChatMessages = ({ messages }) => {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((msg, index) => (
        <div
          key={index}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[80%] rounded-lg p-3 ${
              msg.role === 'user'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-800'
            }`}
          >
            <p className="whitespace-pre-wrap">{msg.content}</p>
            {msg.variants && msg.variants.length > 0 && (
              <div className="mt-2 space-y-2">
                {msg.variants.map((variant) => (
                  <div key={variant.id} className="bg-white bg-opacity-20 rounded p-2">
                    <p className="font-semibold">{variant.description}</p>
                    <p className="text-sm mt-1">Вероятность одобрения: {Math.round(variant.approvalProbability * 100)}%</p>
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


