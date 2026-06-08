import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheckCircle, faSpinner, faXmark,
  faCreditCard, faLeaf, faShieldHalved,
} from '@fortawesome/free-solid-svg-icons';
import api from '../api/axios';

/**
 * PaymentModal
 *
 * Opens a Razorpay checkout sheet for a completed ride.
 * Falls back to a "demo mode" confirmation if Razorpay keys aren't configured.
 *
 * Props:
 *   ride      — completed Ride object (needs ride.id and ride.fare)
 *   onSuccess — called when payment is confirmed (payment object passed)
 *   onClose   — called on skip or after success
 */

// Dynamically load Razorpay checkout script
function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const RAZORPAY_KEY = import.meta.env.VITE_RAZORPAY_KEY_ID || '';

const PaymentModal = ({ ride, onSuccess, onClose }) => {
  const [step,     setStep]     = useState('confirm'); // confirm | processing | success | error | demo
  const [error,    setError]    = useState(null);
  const [payment,  setPayment]  = useState(null);

  const handlePay = async () => {
    setStep('processing');
    setError(null);

    try {
      // 1. Create Razorpay order on backend
      const orderRes = await api.post('/payments/create-order', { ride_id: ride.id });

      // Demo mode — backend returned 503 with demo_mode flag
      if (orderRes.data?.demo_mode) {
        setStep('demo');
        return;
      }

      const { order_id, amount_paise, key_id } = orderRes.data;

      // 2. Load Razorpay SDK
      const rzpLoaded = await loadRazorpay();
      if (!rzpLoaded) {
        setError('Failed to load payment gateway. Please check your connection.');
        setStep('error');
        return;
      }

      // 3. Open Razorpay checkout
      await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key:         key_id || RAZORPAY_KEY,
          amount:      amount_paise,
          currency:    'INR',
          name:        'SmartRide',
          description: `Ride from ${ride.pickup?.address?.split(',')[0]} to ${ride.dropoff?.address?.split(',')[0]}`,
          order_id:    order_id,
          theme:       { color: '#10b981' },
          handler: async (response) => {
            try {
              // 4. Verify signature on backend
              const verifyRes = await api.post('/payments/verify', {
                razorpay_order_id:   response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature:  response.razorpay_signature,
                ride_id:             ride.id,
              });
              setPayment(verifyRes.data.payment);
              setStep('success');
              onSuccess?.(verifyRes.data.payment);
              resolve();
            } catch (err) {
              setError(err.response?.data?.error || 'Payment verification failed');
              setStep('error');
              reject(err);
            }
          },
          modal: {
            ondismiss: () => {
              setStep('confirm');
              resolve();
            },
          },
        });
        rzp.open();
      });

    } catch (err) {
      if (err.response?.data?.demo_mode) {
        setStep('demo');
        return;
      }
      setError(err.response?.data?.error || 'Payment failed. Please try again.');
      setStep('error');
    }
  };

  // Demo mode: simulate successful payment without real Razorpay
  const handleDemoConfirm = async () => {
    setStep('processing');
    await new Promise(r => setTimeout(r, 1500)); // simulate network delay
    setStep('success');
    onSuccess?.({ status: 'paid', demo: true });
  };

  return (
    <div className="fixed inset-0 z-[10001] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center animate-fade-in">
      <div className="bg-white w-full md:max-w-md md:rounded-3xl rounded-t-3xl shadow-2xl p-8 animate-slide-up">

        {/* ── Success ──────────────────────────────────────────────────── */}
        {step === 'success' && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
              <FontAwesomeIcon icon={faCheckCircle} className="text-emerald-500 text-4xl" />
            </div>
            <p className="text-2xl font-black text-gray-900">Payment Successful!</p>
            <p className="text-sm text-gray-500">₹{ride?.fare?.toFixed(0)} paid for your SmartRide.</p>
            <button onClick={onClose}
              className="mt-2 w-full py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-black rounded-2xl shadow-lg">
              Continue
            </button>
          </div>
        )}

        {/* ── Processing ───────────────────────────────────────────────── */}
        {step === 'processing' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <FontAwesomeIcon icon={faSpinner} className="text-emerald-500 text-5xl animate-spin" />
            <p className="text-lg font-black text-gray-800">Processing payment...</p>
          </div>
        )}

        {/* ── Demo Mode ────────────────────────────────────────────────── */}
        {step === 'demo' && (
          <div className="flex flex-col items-center gap-4">
            <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 w-full text-center mb-2">
              <p className="text-sm font-bold text-amber-700">
                🔧 Demo Mode — Razorpay keys not configured
              </p>
              <p className="text-xs text-amber-600 mt-1">
                Add RAZORPAY_KEY_ID to backend/.env to enable real payments.
              </p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-black text-emerald-600">₹{ride?.fare?.toFixed(0)}</p>
              <p className="text-sm text-gray-500 mt-1">Simulate payment confirmation</p>
            </div>
            <div className="flex gap-3 w-full">
              <button onClick={() => setStep('pay_later_explain')}
                className="flex-1 py-3.5 border-2 border-gray-200 text-gray-600 font-black rounded-2xl">
                Skip
              </button>
              <button onClick={handleDemoConfirm}
                className="flex-1 py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-black rounded-2xl shadow-lg">
                ✓ Confirm (Demo)
              </button>
            </div>
          </div>
        )}

        {/* ── Error ────────────────────────────────────────────────────── */}
        {step === 'error' && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <FontAwesomeIcon icon={faXmark} className="text-red-500 text-3xl" />
            </div>
            <p className="text-lg font-black text-gray-900">Payment Failed</p>
            <p className="text-sm text-red-500 text-center">{error}</p>
            <div className="flex gap-3 w-full">
              <button onClick={() => setStep('pay_later_explain')}
                className="flex-1 py-3.5 border-2 border-gray-200 text-gray-600 font-black rounded-2xl">
                Skip
              </button>
              <button onClick={() => setStep('confirm')}
                className="flex-1 py-3.5 bg-red-500 hover:bg-red-600 text-white font-black rounded-2xl shadow-lg">
                Retry
              </button>
            </div>
          </div>
        )}

        {/* ── Pay Later Explanation (Issue 12) ────────────────────────── */}
        {step === 'pay_later_explain' && (
          <div className="flex flex-col items-center gap-4 py-4 text-center animate-fade-in">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
              <FontAwesomeIcon icon={faShieldHalved} className="text-blue-500 text-3xl" />
            </div>
            <p className="text-xl font-black text-gray-950">Pay Later Confirmed</p>
            <div className="text-xs text-gray-550 space-y-2 leading-relaxed">
              <p>Your ride details have been saved, and the ride is complete.</p>
              <p className="font-semibold text-gray-700">You can clear this outstanding balance of ₹{ride?.fare?.toFixed(0)} at your convenience from the <strong className="text-emerald-600">"My Rides"</strong> tab.</p>
            </div>
            <button onClick={onClose}
              className="mt-4 w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-lg transition-all">
              Got it, thanks!
            </button>
          </div>
        )}

        {/* ── Confirm ─────────────────────────────────────────────────── */}
        {step === 'confirm' && (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-black text-gray-900">Pay for Ride</h2>
                <p className="text-sm text-gray-400 mt-0.5">Complete your trip payment</p>
              </div>
              <button onClick={onClose}
                className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-all">
                <FontAwesomeIcon icon={faXmark} className="text-gray-500" />
              </button>
            </div>

            {/* Fare card */}
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200 rounded-2xl p-5 mb-6">
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-bold text-gray-700">Total Amount</span>
                <span className="text-4xl font-black text-emerald-600">₹{ride?.fare?.toFixed(0)}</span>
              </div>
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-emerald-200 text-center">
                <div>
                  <p className="text-xs text-emerald-600 font-bold mb-1">Distance</p>
                  <p className="text-sm font-black text-gray-800">{ride?.distance_km?.toFixed(1)} km</p>
                </div>
                <div>
                  <p className="text-xs text-emerald-600 font-bold mb-1">Ride Type</p>
                  <p className="text-sm font-black text-gray-800 capitalize">{ride?.ride_type}</p>
                </div>
                <div>
                  <p className="text-xs text-emerald-600 font-bold mb-1">Green Pts</p>
                  <p className="text-sm font-black text-emerald-600 flex items-center justify-center gap-0.5">
                    <FontAwesomeIcon icon={faLeaf} className="text-xs" />
                    +{ride?.green_points_awarded || 0}
                  </p>
                </div>
              </div>
            </div>

            {/* Trust signals */}
            <div className="flex items-center gap-2 text-xs text-gray-400 font-bold mb-6">
              <FontAwesomeIcon icon={faShieldHalved} className="text-emerald-400" />
              Secured by Razorpay · UPI · Cards · Netbanking
            </div>

            <p className="text-[10px] text-gray-400 text-center mb-3">
              Choosing "Pay Later" means your ride is complete but payment is pending. You can pay from My Rides.
            </p>

            <div className="flex gap-3">
              <button onClick={() => setStep('pay_later_explain')}
                className="flex-1 py-3.5 border-2 border-gray-200 hover:border-gray-300 text-gray-600 font-black rounded-2xl transition-all">
                Pay Later
              </button>
              <button onClick={handlePay}
                className="flex-1 py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-black rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2">
                <FontAwesomeIcon icon={faCreditCard} />
                Pay ₹{ride?.fare?.toFixed(0)}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentModal;
