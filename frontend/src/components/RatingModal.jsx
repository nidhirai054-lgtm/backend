import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faStar, faXmark, faCheckCircle, faSpinner,
} from '@fortawesome/free-solid-svg-icons';
import api from '../api/axios';

/**
 * RatingModal
 *
 * Shown to the passenger after a ride completes.
 * Allows rating the driver 1–5 stars with an optional review.
 *
 * Props:
 *   ride     — completed Ride object
 *   driver   — Driver User object
 *   onClose  — called after submit or skip
 */
const RatingModal = ({ ride, driver, onClose }) => {
  const [rating,    setRating]    = useState(0);
  const [hovered,   setHovered]   = useState(0);
  const [review,    setReview]    = useState('');
  const [loading,   setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error,     setError]     = useState(null);

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Please select a star rating');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.post(`/rides/${ride.id}/rate`, { rating, review });
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit rating');
    } finally {
      setLoading(false);
    }
  };

  const starLabel = ['', 'Terrible', 'Bad', 'Okay', 'Good', 'Excellent'];

  if (submitted) {
    return (
      <div className="fixed inset-0 z-[10001] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in">
        <div className="bg-white rounded-3xl shadow-2xl p-10 flex flex-col items-center gap-4 animate-scale-in">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
            <FontAwesomeIcon icon={faCheckCircle} className="text-emerald-500 text-4xl" />
          </div>
          <p className="text-xl font-black text-gray-900">Thanks for rating!</p>
          <p className="text-sm text-gray-500">Your feedback helps keep SmartRide safe.</p>
          <button onClick={onClose}
            className="mt-2 px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl transition-all">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[10001] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center animate-fade-in">
      <div className="bg-white w-full md:max-w-md md:rounded-3xl rounded-t-3xl shadow-2xl p-8 animate-slide-up">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-black text-gray-900">Rate Your Driver</h2>
            <p className="text-sm text-gray-400 mt-0.5">How was your experience?</p>
          </div>
          <button onClick={onClose}
            className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-all">
            <FontAwesomeIcon icon={faXmark} className="text-gray-500" />
          </button>
        </div>

        {/* Driver info */}
        {driver && (
          <div className="flex items-center gap-4 bg-gray-50 rounded-2xl p-4 mb-6">
            <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center text-white text-xl font-black">
              {driver.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <p className="font-black text-gray-900">{driver.name}</p>
              <p className="text-sm text-gray-500 capitalize">{driver.vehicle_type || 'Sedan'} · {ride?.ride_type}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-2xl font-black text-emerald-600">₹{ride?.fare?.toFixed(0)}</p>
              <p className="text-xs text-gray-400">{ride?.distance_km?.toFixed(1)} km</p>
            </div>
          </div>
        )}

        {/* Stars */}
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHovered(star)}
                onMouseLeave={() => setHovered(0)}
                className="transition-transform hover:scale-125 active:scale-110"
              >
                <FontAwesomeIcon
                  icon={faStar}
                  className={`text-4xl transition-colors ${
                    star <= (hovered || rating)
                      ? 'text-yellow-400'
                      : 'text-gray-200'
                  }`}
                />
              </button>
            ))}
          </div>
          {(hovered || rating) > 0 && (
            <p className="text-sm font-bold text-gray-600 animate-fade-in">
              {starLabel[hovered || rating]}
            </p>
          )}
        </div>

        {/* Optional review */}
        <textarea
          value={review}
          onChange={(e) => setReview(e.target.value)}
          placeholder="Leave a comment (optional)..."
          rows={3}
          className="w-full border-2 border-gray-100 focus:border-emerald-300 rounded-2xl p-4 text-sm resize-none outline-none transition-colors mb-4"
        />

        {error && (
          <p className="text-sm text-red-500 font-bold mb-3 text-center">{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3.5 border-2 border-gray-200 hover:border-gray-300 text-gray-600 font-black rounded-2xl transition-all"
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || rating === 0}
            className="flex-1 py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-black rounded-2xl shadow-lg hover:shadow-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading
              ? <><FontAwesomeIcon icon={faSpinner} className="animate-spin" /> Submitting...</>
              : '⭐ Submit Rating'
            }
          </button>
        </div>
      </div>
    </div>
  );
};

export default RatingModal;
