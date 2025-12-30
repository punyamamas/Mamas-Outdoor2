import React, { useState } from 'react';
import { Star, X, Send, Loader2 } from 'lucide-react';
import { submitReview } from '../services/reviewService';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionId: string;
  customerName: string;
  onSuccess: () => void;
}

const ReviewModal: React.FC<ReviewModalProps> = ({ isOpen, onClose, transactionId, customerName, onSuccess }) => {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (rating === 0) return alert("Silakan pilih bintang dulu ya kak!");
    setIsSubmitting(true);

    const success = await submitReview(transactionId, customerName, rating, comment);
    
    if (success) {
      onSuccess();
      onClose();
    } else {
      alert("Gagal mengirim ulasan. Coba lagi nanti ya.");
    }
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-slide-in-right md:animate-none md:scale-100">
        <div className="bg-nature-600 px-6 py-4 flex justify-between items-center text-white">
          <h3 className="font-bold text-lg">Beri Ulasan</h3>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full transition"><X size={20} /></button>
        </div>

        <div className="p-6">
          <div className="text-center mb-6">
            <p className="text-sm text-gray-500 mb-1">Bagaimana pengalaman sewa kamu?</p>
            <h4 className="font-bold text-gray-800 text-lg">{customerName}</h4>
          </div>

          {/* Star Rating */}
          <div className="flex justify-center gap-2 mb-6">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className="transition-transform hover:scale-110 focus:outline-none"
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setRating(star)}
              >
                <Star 
                  size={36} 
                  className={`transition-colors duration-200 ${
                    star <= (hoverRating || rating) 
                      ? 'fill-yellow-400 text-yellow-400 drop-shadow-sm' 
                      : 'fill-gray-100 text-gray-300'
                  }`}
                />
              </button>
            ))}
          </div>
          
          <div className="text-center mb-6 text-sm font-bold text-nature-600 h-5">
            {rating === 5 ? "Luar Biasa! 😍" : 
             rating === 4 ? "Bagus Banget! 😄" :
             rating === 3 ? "Lumayan Oke 🙂" :
             rating === 2 ? "Kurang Memuaskan 😞" :
             rating === 1 ? "Sangat Kecewa 😭" : "Klik Bintang"}
          </div>

          <div className="mb-6">
            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Ceritakan Pengalamanmu</label>
            <textarea
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-nature-500 outline-none resize-none bg-gray-50 focus:bg-white transition"
              rows={4}
              placeholder="Alatnya bersih? Admin ramah? Tulis disini..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            ></textarea>
          </div>

          <button
            onClick={handleSubmit}
            disabled={rating === 0 || isSubmitting}
            className="w-full bg-nature-600 hover:bg-nature-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl shadow-lg shadow-nature-200 transition flex items-center justify-center gap-2"
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Send size={18} />}
            Kirim Ulasan
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReviewModal;
