// Loads the Razorpay Checkout script once and resolves with window.Razorpay.
// The key_id always comes from the backend (payment order response) — never
// hardcoded client-side.
let razorpayPromise = null;

export const loadRazorpay = () => {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (razorpayPromise) return razorpayPromise;

  razorpayPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => {
      razorpayPromise = null;
      reject(new Error('Failed to load Razorpay checkout. Check your connection.'));
    };
    document.body.appendChild(script);
  });

  return razorpayPromise;
};
