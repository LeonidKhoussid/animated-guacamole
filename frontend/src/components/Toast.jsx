import { useState, useEffect } from 'react';

let toastId = 0;
const toasts = [];
const listeners = [];

export const toast = {
  success: (message) => addToast('success', message),
  error: (message) => addToast('error', message),
  info: (message) => addToast('info', message),
  warning: (message) => addToast('warning', message),
};

const addToast = (type, message) => {
  const id = toastId++;
  const newToast = { id, type, message };
  toasts.push(newToast);
  listeners.forEach((listener) => listener([...toasts]));
  
  setTimeout(() => {
    removeToast(id);
  }, 5000);
  
  return id;
};

const removeToast = (id) => {
  const index = toasts.findIndex((t) => t.id === id);
  if (index > -1) {
    toasts.splice(index, 1);
    listeners.forEach((listener) => listener([...toasts]));
  }
};

export const ToastContainer = () => {
  const [toastList, setToastList] = useState([]);

  useEffect(() => {
    listeners.push(setToastList);
    return () => {
      const index = listeners.indexOf(setToastList);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, []);

  const getToastStyles = (type) => {
    const styles = {
      success: 'bg-green-500',
      error: 'bg-red-500',
      info: 'bg-blue-500',
      warning: 'bg-yellow-500',
    };
    return styles[type] || styles.info;
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toastList.map((toast) => (
        <div
          key={toast.id}
          className={`${getToastStyles(toast.type)} text-white px-4 py-2 rounded shadow-lg flex items-center justify-between min-w-[300px]`}
        >
          <span>{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="ml-4 text-white hover:text-gray-200"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};


