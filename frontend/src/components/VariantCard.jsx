import { Link } from 'react-router-dom';

export const VariantCard = ({ variant, onContinueConversation, onClick }) => {
  if (!variant) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4 text-gray-500 text-sm">
        Variant unavailable.
      </div>
    );
  }

  const handleCardClick = (e) => {
    // If onClick is provided, call it
    if (onClick) {
      onClick();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-4 flex flex-col">
      <Link
        to={variant.id ? `/variant/${variant.id}` : '#'}
        className="flex-1"
        onClick={handleCardClick}
      >
        {variant.thumbnailUrl && (
          <img
            src={variant.thumbnailUrl}
            alt={variant.description}
            className="w-full h-48 object-cover rounded mb-3"
          />
        )}
        <h3 className="font-semibold text-lg mb-2 line-clamp-2">{variant.description}</h3>
        <p className="text-sm text-gray-600 mb-2 line-clamp-2">{variant.normativeExplanation}</p>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-blue-600">
            Вероятность одобрения: {Math.round(variant.approvalProbability * 100)}%
          </span>
        </div>
      </Link>
      <div className="flex space-x-2 mt-auto pt-3 border-t">
        <Link
          to={`/variant/${variant.id}`}
          className="flex-1 text-center bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
        >
          Подробнее
        </Link>
        {onContinueConversation && (
          <button
            onClick={(e) => {
              e.preventDefault();
              onContinueConversation(variant);
            }}
            className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
          >
            Спросить
          </button>
        )}
      </div>
    </div>
  );
};

