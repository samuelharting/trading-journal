import React, { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Tilt from "react-parallax-tilt";
import { StarIcon, PlusIcon, ChevronLeftIcon, ChevronRightIcon, XMarkIcon, InformationCircleIcon } from '@heroicons/react/24/solid';
import { UserContext } from "../App";
import { useHeader } from "../components/Layout";
import { db } from '../firebase';
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import Spinner from '../components/MatrixLoader';

const TradesPage = () => {
  const { user } = useContext(UserContext);
  const { setShowHeader } = useHeader();
  const [images, setImages] = useState([]);
  const [favorites, setFavorites] = useState({});
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showTradeDetails, setShowTradeDetails] = useState(false);
  const [tradeEntry, setTradeEntry] = useState(null);
  const [isHovering, setIsHovering] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      // Fetch all entries
      const entriesCol = collection(db, 'journalEntries', user, 'entries');
      const snap = await getDocs(entriesCol);
      const allEntries = snap.docs.map(doc => ({ ...doc.data(), id: doc.id })).sort((a, b) => new Date(b.created) - new Date(a.created));
      // Fetch favorites
      const favDoc = await getDoc(doc(db, 'favorites', user));
      setFavorites(favDoc.exists() ? favDoc.data().data : {});
      // Build images array with entry data
      const allImages = [];
      allEntries.forEach(entry => {
        if (entry.screenshots && entry.screenshots.length) {
          entry.screenshots.forEach(src => {
            allImages.push({
              src,
              created: entry.created,
              entry: entry,
              link: `/day/${entry.month}/${entry.day}`
            });
          });
        }
      });
      setImages(allImages);
    };
    fetchData();
  }, [user]);

  // Ensure header is shown when component unmounts
  useEffect(() => {
    return () => {
      setShowHeader(true);
    };
  }, [setShowHeader]);

  const toggleFavorite = async (src) => {
    const updated = { ...favorites, [src]: !favorites[src] };
    // Sanitize: only keep keys with boolean values
    const sanitized = Object.fromEntries(
      Object.entries(updated).filter(([k, v]) => typeof v === "boolean")
    );
    setFavorites(sanitized);
    await setDoc(doc(db, 'favorites', user), { data: sanitized });
  };

  const openImageViewer = (image, index) => {
    setSelectedImage(image);
    setSelectedImageIndex(index);
    setTradeEntry(image.entry);
    setShowTradeDetails(false);
    setIsHovering(false);
    setShowHeader(false);
  };

  const closeImageViewer = () => {
    setSelectedImage(null);
    setSelectedImageIndex(0);
    setTradeEntry(null);
    setShowTradeDetails(false);
    setIsHovering(false);
    setShowHeader(true);
  };

  const navigateImage = (direction) => {
    if (direction === 'prev') {
      const newIndex = selectedImageIndex > 0 ? selectedImageIndex - 1 : images.length - 1;
      setSelectedImageIndex(newIndex);
      setSelectedImage(images[newIndex]);
      setTradeEntry(images[newIndex].entry);
    } else {
      const newIndex = selectedImageIndex < images.length - 1 ? selectedImageIndex + 1 : 0;
      setSelectedImageIndex(newIndex);
      setSelectedImage(images[newIndex]);
      setTradeEntry(images[newIndex].entry);
    }
    setShowTradeDetails(false);
    setIsHovering(false);
  };

  const goToDay = () => {
    if (tradeEntry) {
      navigate(`/day/${tradeEntry.month}/${tradeEntry.day}`);
    }
  };

  const handleKeyDown = (e) => {
    if (!selectedImage) return;
    if (e.key === 'Escape') {
      closeImageViewer();
    } else if (e.key === 'ArrowLeft') {
      navigateImage('prev');
    } else if (e.key === 'ArrowRight') {
      navigateImage('next');
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedImage, selectedImageIndex]);

  return (
    <div className="w-full min-h-screen bg-black pt-20 px-4 sm:px-8 relative overflow-x-hidden" style={{ zIndex: 0 }}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7 }}
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6 sm:gap-12 w-full"
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
                  <StarIcon className={`w-6 h-6 sm:w-8 sm:h-8 ${favorites[img.src] ? 'text-yellow-400' : 'text-gray-400'}`} />
                </motion.span>
              </button>
              <motion.img
                src={img.src}
                alt="Trade Screenshot"
                className="w-full h-full object-cover aspect-square rounded-xl border-none transition-transform duration-300 group-hover:scale-110 group-hover:shadow-2xl"
                whileHover={{ scale: 1.12 }}
                transition={{ type: 'spring', stiffness: 300 }}
                onClick={() => openImageViewer(img, idx)}
                style={{ cursor: "pointer" }}
              />
              <div className="text-xs text-neutral-500 mt-2">{new Date(img.created).toLocaleString()}</div>
            </motion.div>
          </Tilt>
        ))}
      </motion.div>

      {/* Image Viewer Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50 p-4"
            onClick={closeImageViewer}
          >
            <div className="relative max-w-full max-h-full">
              {/* Close Button */}
              <button
                onClick={closeImageViewer}
                className="absolute top-4 right-4 z-10 bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-75 transition-all"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>

              {/* Navigation Arrows */}
              <button
                onClick={(e) => { e.stopPropagation(); navigateImage('prev'); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-black bg-opacity-50 text-white rounded-full p-3 hover:bg-opacity-75 transition-all"
              >
                <ChevronLeftIcon className="w-8 h-8" />
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); navigateImage('next'); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-black bg-opacity-50 text-white rounded-full p-3 hover:bg-opacity-75 transition-all"
              >
                <ChevronRightIcon className="w-8 h-8" />
              </button>

              {/* Image with Hover Detection */}
              <motion.img
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                src={selectedImage.src}
                alt="Trade Screenshot"
                className="max-w-full max-h-[90vh] object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
              />

              {/* Trade Details Panel - Hover to Reveal */}
              <AnimatePresence>
                {isHovering && tradeEntry && (
                  <motion.div
                    initial={{ opacity: 0, x: -300 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -300 }}
                    className="absolute top-0 left-0 h-full w-80 bg-neutral-900 bg-opacity-95 backdrop-blur-md p-6 overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                    onMouseEnter={() => setIsHovering(true)}
                    onMouseLeave={() => setIsHovering(false)}
                  >
                    <div className="space-y-4">
                      <h3 className="text-xl font-bold text-[#e5e5e5] mb-4">Trade Details</h3>
                      
                      <div className="space-y-3">
                        <div>
                          <span className="text-sm text-neutral-400">Date:</span>
                          <div className="text-[#e5e5e5] font-semibold">
                            {new Date(tradeEntry.created).toLocaleDateString()}
                          </div>
                        </div>
                        
                        {tradeEntry.tickerTraded && (
                          <div>
                            <span className="text-sm text-neutral-400">Ticker:</span>
                            <div className="text-[#e5e5e5] font-semibold">{tradeEntry.tickerTraded}</div>
                          </div>
                        )}
                        
                        {tradeEntry.pnl !== undefined && (
                          <div>
                            <span className="text-sm text-neutral-400">P&L:</span>
                            <div className={`font-semibold ${tradeEntry.pnl > 0 ? 'text-green-400' : tradeEntry.pnl < 0 ? 'text-red-400' : 'text-[#e5e5e5]'}`}>
                              {tradeEntry.pnl > 0 ? '+' : ''}{tradeEntry.pnl?.toFixed(2) || '0.00'}
                            </div>
                          </div>
                        )}
                        
                        {tradeEntry.rr && (
                          <div>
                            <span className="text-sm text-neutral-400">R:R:</span>
                            <div className="text-[#e5e5e5] font-semibold">{tradeEntry.rr}</div>
                          </div>
                        )}
                        
                        {tradeEntry.grade && (
                          <div>
                            <span className="text-sm text-neutral-400">Grade:</span>
                            <div className="text-[#e5e5e5] font-semibold">{tradeEntry.grade}</div>
                          </div>
                        )}
                        
                        {tradeEntry.notes && (
                          <div>
                            <span className="text-sm text-neutral-400">Notes:</span>
                            <div className="text-[#e5e5e5] text-sm mt-1">{tradeEntry.notes}</div>
                          </div>
                        )}
                      </div>
                      
                      <button
                        onClick={goToDay}
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-4 py-3 rounded-lg font-semibold transition-all mt-6 shadow-lg"
                      >
                        Go to Day
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Image Info */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black bg-opacity-50 text-white px-4 py-2 rounded-lg text-sm">
                {selectedImageIndex + 1} of {images.length} • {new Date(selectedImage.created).toLocaleString()}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TradesPage; 