import React, { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Tilt from "react-parallax-tilt";
import { StarIcon, PlusIcon } from '@heroicons/react/24/solid';
import { UserContext } from "../App";

function getAllJournalEntries(user) {
  const entries = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(`journal-${user}-`)) {
      try {
        const dayEntries = JSON.parse(localStorage.getItem(key));
        if (Array.isArray(dayEntries)) {
          const [_, __, year, month, day] = key.split("-");
          dayEntries.forEach(entry => {
            entries.push({ ...entry, year, month, day });
          });
        }
      } catch {}
    }
  }
  // Sort by created date ascending
  return entries.sort((a, b) => new Date(a.created) - new Date(b.created));
}

const TradesPage = () => {
  const { user } = useContext(UserContext);
  const [images, setImages] = useState([]);
  const [favorites, setFavorites] = useState(() => {
    if (!user) return {};
    const favs = localStorage.getItem(`favoriteTrades-${user}`);
    return favs ? JSON.parse(favs) : {};
  });
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const allEntries = getAllJournalEntries(user);
    const allImages = [];
    allEntries.forEach(entry => {
      if (entry.screenshots && entry.screenshots.length) {
        entry.screenshots.forEach(src => {
          allImages.push({
            src,
            created: entry.created,
            link: `/day/${entry.month}/${entry.day}`
          });
        });
      }
    });
    setImages(allImages.reverse()); // Newest first
  }, [user]);

  const toggleFavorite = (src) => {
    setFavorites(prev => {
      const updated = { ...prev, [src]: !prev[src] };
      localStorage.setItem(`favoriteTrades-${user}`, JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <div className="w-full min-h-screen bg-black pt-20 px-8 relative overflow-x-hidden" style={{ zIndex: 0 }}>
      <h2 className="text-3xl font-bold mb-8 text-[#e5e5e5]">All Trade Images</h2>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7 }}
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-12 w-full"
      >
        {images.length === 0 && (
          <div className="flex flex-col items-center justify-center col-span-full py-24">
            <img src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f680.png" alt="Rocket" className="w-24 h-24 mb-6 animate-bounce" />
            <div className="text-2xl font-bold text-[#e5e5e5] mb-2">No trades yet!</div>
            <div className="text-lg text-neutral-400">Go crush it! 🚀</div>
          </div>
        )}
        {images.map((img, idx) => (
          <Tilt
            key={idx}
            glareEnable={true}
            glareMaxOpacity={0.15}
            glareColor="#fff"
            glarePosition="all"
            tiltMaxAngleX={10}
            tiltMaxAngleY={10}
            scale={1.03}
            transitionSpeed={1200}
            className="relative"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.08 }}
              transition={{ duration: 0.3, delay: idx * 0.03 }}
              className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 flex flex-col items-center border border-white/20 shadow-xl cursor-pointer group overflow-hidden aspect-square w-full"
            >
              {/* Favorite Star */}
              <button
                className="absolute top-4 right-4 z-10"
                onClick={e => { e.stopPropagation(); toggleFavorite(img.src); }}
                aria-label={favorites[img.src] ? 'Unfavorite' : 'Favorite'}
                style={{ background: 'rgba(0,0,0,0.5)', borderRadius: '9999px', padding: 4 }}
              >
                <motion.span
                  initial={{ scale: 0.8 }}
                  animate={{ scale: favorites[img.src] ? 1.2 : 1 }}
                  transition={{ type: 'spring', stiffness: 400 }}
                >
                  <StarIcon className={`w-8 h-8 ${favorites[img.src] ? 'text-yellow-400' : 'text-gray-400'}`} />
                </motion.span>
              </button>
              <a href={img.link} className="block mb-4 w-full h-full" title="Go to journal entry">
                <motion.img
                  src={img.src}
                  alt="Trade Screenshot"
                  className="w-full h-full object-cover aspect-square rounded-xl border-none transition-transform duration-300 group-hover:scale-110 group-hover:shadow-2xl"
                  whileHover={{ scale: 1.12 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                />
              </a>
              <div className="text-xs text-neutral-500 mt-2">{new Date(img.created).toLocaleString()}</div>
            </motion.div>
          </Tilt>
        ))}
      </motion.div>
    </div>
  );
};

export default TradesPage; 