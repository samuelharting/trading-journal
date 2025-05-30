import React, { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Tilt from "react-parallax-tilt";
import { StarIcon, PlusIcon } from '@heroicons/react/24/solid';
import { UserContext } from "../App";
import { db } from '../firebase';
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import Spinner from '../components/MatrixLoader';

const TradesPage = () => {
  const { user } = useContext(UserContext);
  const [images, setImages] = useState([]);
  const [favorites, setFavorites] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      // Fetch all entries
      const entriesCol = collection(db, 'journalEntries', user, 'entries');
      const snap = await getDocs(entriesCol);
      const allEntries = snap.docs.map(doc => doc.data()).sort((a, b) => new Date(b.created) - new Date(a.created));
      // Fetch favorites
      const favDoc = await getDoc(doc(db, 'favorites', user));
      setFavorites(favDoc.exists() ? favDoc.data().data : {});
      // Build images array
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
      setImages(allImages);
    };
    fetchData();
  }, [user]);

  const toggleFavorite = async (src) => {
    const updated = { ...favorites, [src]: !favorites[src] };
    // Sanitize: only keep keys with boolean values
    const sanitized = Object.fromEntries(
      Object.entries(updated).filter(([k, v]) => typeof v === "boolean")
    );
    setFavorites(sanitized);
    await setDoc(doc(db, 'favorites', user), { data: sanitized });
  };

  return (
    <div className="w-full min-h-screen bg-black pt-20 px-8 relative overflow-x-hidden" style={{ zIndex: 0 }}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7 }}
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-12 w-full"
      >
        {images.length === 0 && (
          <div className="flex flex-col items-center justify-center col-span-full py-24">
            <Spinner size={48} />
            <div className="text-2xl font-bold text-[#e5e5e5] mb-2 mt-8">No trades yet!</div>
            <div className="text-lg text-green-400">Welcome to your trading journal. Add your first trade!</div>
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
              <motion.img
                src={img.src}
                alt="Trade Screenshot"
                className="w-full h-full object-cover aspect-square rounded-xl border-none transition-transform duration-300 group-hover:scale-110 group-hover:shadow-2xl"
                whileHover={{ scale: 1.12 }}
                transition={{ type: 'spring', stiffness: 300 }}
                onClick={() => navigate(img.link)}
                style={{ cursor: "pointer" }}
              />
              <div className="text-xs text-neutral-500 mt-2">{new Date(img.created).toLocaleString()}</div>
            </motion.div>
          </Tilt>
        ))}
      </motion.div>
    </div>
  );
};

export default TradesPage; 