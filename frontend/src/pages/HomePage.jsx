import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { BottomNav } from '../components/BottomNav.jsx';

export const HomePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Extract first name from full name
  const firstName = user?.fullName?.split(' ')[0] || 'Пользователь';

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-20 overflow-x-hidden">
      {/* Header */}
      <div className="bg-gradient-to-b from-blue-100 to-white px-4 pt-4 pb-6">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            {/* TODO: Replace with actual user profile image URL */}
            <img
              src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='50' height='50'%3E%3Crect fill='%232593F4' width='50' height='50'/%3E%3Ctext fill='white' x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='20'%3EU%3C/text%3E%3C/svg%3E"
              alt="Profile"
              className="w-12 h-12 rounded-full object-cover"
            />
            <div>
              <p className="text-sm text-gray-600">Добрый день!</p>
              <p className="font-bold text-lg text-gray-900">{firstName}</p>
            </div>
          </div>
          
        </div>

        <div className="bg-gradient-to-br from-[#2593F4] to-blue-700 rounded-2xl relative overflow-visible flex items-center">
          <div className="relative z-10 p-4 flex-1 min-w-0">
            <h1 className="text-lg font-bold text-white mb-2">
              Планируйте ремонт безопасно и наглядно
            </h1>
            <p className="text-white text-xs mb-4 opacity-90">
              Загрузите план квартиры и получите варианты перепланировки и дизайна с проверкой по нормам.
            </p>
            <button
              onClick={() => navigate('/upload')}
              className="bg-white text-blue-600 font-semibold px-4 py-2 rounded-xl hover:bg-blue-50 transition-colors text-sm"
            >
              Загрузить план
            </button>
          </div>
          {/* TODO: Replace with actual 3D apartment rendering image URL */}
          <div className="relative flex-shrink-0 -mr-8">
            <img
              src="https://storage.yandexcloud.net/optika/plan_ai/heroPgHouse1.png" // IMAGE_URL: 3D isometric apartment layout (right side of banner)
              alt="Apartment layout"
              className="h-50 w-auto object-contain"
            />
          </div>
        </div>
      </div>

      {/* Feature Section */}
      <div className="px-4 mt-8">
        <div className="grid grid-cols-2 gap-4">
          {/* Top Left - Text Content */}
          <div className="flex flex-col gap-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">
              С помощью нашего сервиса вы можете
            </h2>
            <p className="text-sm text-gray-600">
              Получите варианты вашего дома мечты прямо сейчас!
            </p>
          </div>

          {/* Top Right - AI Replanning Card */}
          <div className="bg-gradient-to-br from-[#2593F4] to-blue-600 rounded-xl p-4 relative overflow-visible">
            {/* TODO: Replace with actual architectural blueprint overlay image URL */}
            <img
              src="https://storage.yandexcloud.net/optika/plan_ai/heroPgHouse2.png" // IMAGE_URL: Architectural blueprint overlay background
              alt="Blueprint"
              className="absolute right-3 top-0 h-full w-auto object-contain"
              style={{ transform: 'translateX(15%)' }}
            />
            <div className="relative z-10">
              <h3 className="font-bold text-white text-base mb-1">Перепланировка AI</h3>
              <p className="text-white text-xs opacity-90">
                Опишите изменения — получите законный вариант
              </p>
            </div>
          </div>

          {/* Bottom Left - 3D View Card */}
          <div className="bg-blue-500 rounded-xl p-4 relative overflow-visible">
            {/* TODO: Replace with actual modern living room image URL */}
            <img
              src="https://storage.yandexcloud.net/optika/plan_ai/heroPgHouse3.png" // IMAGE_URL: Modern living room background
              alt="3D View"
              className="absolute right-0 top-0 h-full w-auto object-contain opacity-20"
              style={{ transform: 'translateX(15%)' }}
            />
            <div className="relative z-10">
              <h3 className="font-bold text-white text-base mb-1">3D-просмотр</h3>
              <p className="text-white text-xs opacity-90">
                Посмотрите квартиру сверху и от первого лица
              </p>
            </div>
          </div>

          {/* Bottom Right - Design AI Card */}
          <div className="bg-gray-50 rounded-xl p-4 relative overflow-visible">
            {/* TODO: Replace with actual modern interior with furniture image URL */}
            <img
              src="https://storage.yandexcloud.net/optika/plan_ai/heroPgHouse4.png" // IMAGE_URL: Modern interior with furniture background
              alt="Design AI"
              className="absolute right-0 top-0 h-full w-auto object-contain opacity-20"
              style={{ transform: 'translateX(15%)' }}
            />
            <div className="relative z-10">
              <h3 className="font-bold text-gray-900 text-base mb-1">Дизайн AI</h3>
              <p className="text-gray-700 text-xs opacity-90">
                Сгенерируем расстановку мебели и стиль
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sharing Banner */}
      <div className="px-4 mt-6">
        <div className="bg-blue-100 rounded-2xl p-2 relative overflow-visible">
          {/* TODO: Replace with actual 3D isometric apartment layout image URL */}
          <img
            src="https://storage.yandexcloud.net/optika/plan_ai/heroPgHouse5.png" // IMAGE_URL: 3D isometric apartment layout (left side)
            alt="Apartment layout"
            className="absolute left-0 top-0 object-cover"
            style={{ transform: 'translateX(-10%)' }}
          />
          <div className="relative z-10 ml-auto" style={{ width: '65%' }}>
            <h3 className="font-bold text-blue-950 text-md mb-3 text-end">
              Поделитесь своими результатами планировки квартиры с другими!
            </h3>
            <button
              onClick={() => navigate('/favorites')}
              className="bg-blue-600 text-white font-semibold py-1 rounded-xl hover:bg-blue-700 transition-colors w-full"
            >
              В избранное
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Navigation Bar */}
      <BottomNav />
    </div>
  );
};

