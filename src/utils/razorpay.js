// Loads the Razorpay Checkout script once and resolves with window.Razorpay.
// The key_id always comes from the backend (payment order response) — never
// hardcoded client-side.
//
// Every Razorpay pop-up in the app must be created through createRazorpayCheckout
// (or built with withCred2TechBranding) so it carries our logo and colours.
// `?inline` embeds the logo as a data URI: Checkout runs in an HTTPS iframe,
// so a plain http://localhost URL would be blocked locally, and a data URI
// needs no public URL on any environment.
import checkoutLogo from '../assets/brand/razorpay-checkout-logo.png?inline';

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

/**
 * Cred2Tech's Checkout branding — the same on every kind of payment.
 * color: brand primary (--primary in index.css, `primary` in the email template).
 * backdrop_color: brand navy (#0a1628, the logo colour) behind the pop-up.
 */
export const RAZORPAY_BRANDING = Object.freeze({
  name: 'Cred2Tech',
  image: checkoutLogo,
  theme: Object.freeze({ color: '#4F46E5', backdrop_color: 'rgba(10, 22, 40, 0.72)' }),
});

/**
 * Returns Checkout options with our name, logo and theme applied. Branding
 * always wins over whatever a caller passed, so no screen can open an
 * unbranded (or differently branded) pop-up.
 */
export const withCred2TechBranding = (options = {}) => ({
  ...options,
  name: RAZORPAY_BRANDING.name,
  image: RAZORPAY_BRANDING.image,
  theme: { ...RAZORPAY_BRANDING.theme },
});

/** Creates a branded Checkout instance. Use this instead of `new Razorpay(...)`. */
export const createRazorpayCheckout = (Razorpay, options) => new Razorpay(withCred2TechBranding(options));
