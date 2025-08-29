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
  const { user, currentUser, selectedAccount } = useContext(UserContext);
  const { setShowHeader } = useHeader();
  const [groupedImages, setGroupedImages] = useState([]);
  const [allImages, setAllImages] = useState([]);
  const [allEntries, setAllEntries] = useState([]); // For navigation through all entries
  const [favorites, setFavorites] = useState({});
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [tradeEntry, setTradeEntry] = useState(null);
  const [showTradeDetails, setShowTradeDetails] = useState(false);
  
  // Filter state
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());
  const [filteredGroups, setFilteredGroups] = useState([]);
  const [showFilter, setShowFilter] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser || !selectedAccount) return;
    const fetchData = async () => {
      const { db } = await import('../firebase');
      const { collection, getDocs, doc, getDoc, setDoc } = await import('firebase/firestore');
      // Fetch all entries for selected account
      const entriesCol = collection(db, 'users', currentUser.uid, 'accounts', selectedAccount.id, 'entries');
      const snap = await getDocs(entriesCol);
      const allEntries = snap.docs.map(doc => ({ ...doc.data(), id: doc.id })).sort((a, b) => {
        // Clean timestamps by removing the random suffix
        const getCleanTimestamp = (created) => {
          if (!created) return '';
          const lastDashIndex = created.lastIndexOf('-');
          return lastDashIndex > 10 ? created.substring(0, lastDashIndex) : created;
        };
        const cleanA = getCleanTimestamp(a.created);
        const cleanB = getCleanTimestamp(b.created);
        return new Date(cleanB) - new Date(cleanA);
      });
      // Fetch favorites
      const favDoc = await getDoc(doc(db, 'favorites', currentUser.uid + '_' + selectedAccount.id));
      setFavorites(favDoc.exists() ? favDoc.data().data : {});
      
      // Build grouped images array AND navigation array
      const grouped = [];
      const allImagesArray = []; // For navigation - contains individual images AND placeholder entries
      
      allEntries.forEach(entry => {
        // For entries with screenshots (trades and tape readings)
        if (entry.screenshots && entry.screenshots.length) {
          const entryImages = entry.screenshots.map((src, imageIndex) => ({
            src,
            created: entry.created,
            entry: entry,
            link: `/day/${entry.month}/${entry.day}`,
            imageIndex: imageIndex, // Track which image within the entry
            isIndividualImage: true
          }));
          
          grouped.push({
            entry: entry,
            images: entryImages,
            totalImages: entryImages.length,
            firstImage: entryImages[0]
          });
          
          // Add ALL individual images to navigation array
          allImagesArray.push(...entryImages);
        }
        // For deposits and payouts (create placeholder)
        else if (entry.isDeposit || entry.isPayout) {
          const placeholderItem = {
            src: null,
            created: entry.created,
            entry: entry,
            link: `/day/${entry.month}/${entry.day}`,
            isIndividualImage: false,
            isDeposit: entry.isDeposit,
            isPayout: entry.isPayout
          };
          
          grouped.push({
            entry: entry,
            images: [],
            totalImages: 0,
            isDeposit: entry.isDeposit,
            isPayout: entry.isPayout
          });
          
          // Add placeholder to navigation array
          allImagesArray.push(placeholderItem);
        }
        // For trades/tape readings without screenshots (still show them with placeholder)
        else if (!entry.isDeposit && !entry.isPayout) {
          const placeholderItem = {
            src: null,
            created: entry.created,
            entry: entry,
            link: `/day/${entry.month}/${entry.day}`,
            isIndividualImage: false,
            isTrade: !entry.tapeReading,
            isTapeReading: entry.tapeReading
          };
          
          grouped.push({
            entry: entry,
            images: [],
            totalImages: 0,
            isTrade: !entry.tapeReading,
            isTapeReading: entry.tapeReading
          });
          
          // Add placeholder to navigation array
          allImagesArray.push(placeholderItem);
        }
      });
      
      // Sort by creation date (newest first) for proper grid flow
      const getCleanTimestamp = (created) => {
        if (!created) return '';
        const lastDashIndex = created.lastIndexOf('-');
        return lastDashIndex > 10 ? created.substring(0, lastDashIndex) : created;
      };
      
      grouped.sort((a, b) => {
        const cleanA = getCleanTimestamp(a.entry.created);
        const cleanB = getCleanTimestamp(b.entry.created);
        return new Date(cleanB) - new Date(cleanA);
      });
      allImagesArray.sort((a, b) => {
        const cleanA = getCleanTimestamp(a.created);
        const cleanB = getCleanTimestamp(b.created);
        return new Date(cleanB) - new Date(cleanA);
      });
      
      // Debug: Log detailed stats
      console.log('TradesPage - Total entries:', allEntries.length, 'Grouped:', grouped.length);
      console.log('TradesPage - Entries with screenshots:', allEntries.filter(e => e.screenshots && e.screenshots.length > 0).length);
      console.log('TradesPage - Sample entry:', allEntries[0] ? {
        screenshots: allEntries[0].screenshots,
        screenshotsLength: allEntries[0].screenshots?.length,
        isDeposit: allEntries[0].isDeposit,
        isPayout: allEntries[0].isPayout,
        tapeReading: allEntries[0].tapeReading,
        created: allEntries[0].created,
        month: allEntries[0].month,
        day: allEntries[0].day
      } : 'No entries');
      
      setGroupedImages(grouped);
      setAllImages(allImagesArray);
      setAllEntries(allEntries); // Store all entries for navigation
    };
    fetchData();
  }, [currentUser, selectedAccount]);



  // Reset filters and ensure header is shown when component unmounts
  useEffect(() => {
    // Reset to current month/year when component mounts
    const now = new Date();
    setSelectedYear(now.getFullYear().toString());
    setSelectedMonth((now.getMonth() + 1).toString());
    
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
    await setDoc(doc(db, 'favorites', currentUser.uid + '_' + selectedAccount.id), { data: sanitized });
  };

  const openImageViewer = (image, entry) => {
    // Find the index of this specific image in the allImages array
    const imageIndex = allImages.findIndex(item => 
      item.entry.created === entry.created && 
      item.src === image.src
    );
    setSelectedImage(image);
    setSelectedImageIndex(imageIndex >= 0 ? imageIndex : 0);
    setTradeEntry(entry);
    setShowHeader(false);
  };
  
  const openEntryDetails = (entry) => {
    // Find the index of this entry's placeholder in the allImages array
    const entryIndex = allImages.findIndex(item => 
      item.entry.created === entry.created && 
      item.src === null
    );
    // Create a mock image object for deposits/payouts/trades without screenshots
    const mockImage = {
      src: null, // No image for these entries
      entry: entry
    };
    setSelectedImage(mockImage);
    setSelectedImageIndex(entryIndex >= 0 ? entryIndex : 0);
    setTradeEntry(entry);
    setShowHeader(false);
  };

  const closeImageViewer = () => {
    setSelectedImage(null);
    setSelectedImageIndex(0);
    setTradeEntry(null);
    setShowTradeDetails(false);
    setShowHeader(true);
  };

  const navigateImage = (direction) => {
    if (direction === 'prev') {
      const newIndex = selectedImageIndex > 0 ? selectedImageIndex - 1 : allImages.length - 1;
      setSelectedImageIndex(newIndex);
      const imageItem = allImages[newIndex];
      
      // Set the selected image directly from the navigation array
      setSelectedImage({
        src: imageItem.src, // Can be null for placeholders
        entry: imageItem.entry,
        imageIndex: imageItem.imageIndex || 0
      });
      setTradeEntry(imageItem.entry);
    } else {
      const newIndex = selectedImageIndex < allImages.length - 1 ? selectedImageIndex + 1 : 0;
      setSelectedImageIndex(newIndex);
      const imageItem = allImages[newIndex];
      
      // Set the selected image directly from the navigation array
      setSelectedImage({
        src: imageItem.src, // Can be null for placeholders
        entry: imageItem.entry,
        imageIndex: imageItem.imageIndex || 0
      });
      setTradeEntry(imageItem.entry);
    }
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
  
  // Filter entries based on selected month and year
  useEffect(() => {
    if (!groupedImages.length) return;
    
    const filtered = groupedImages.filter(group => {
      // First try to use the month/day/year fields (primary approach)
      if (group.entry.month && group.entry.day) {
        const entryYear = group.entry.year || new Date().getFullYear().toString();
        const entryMonth = group.entry.month;
        
        return (
          entryYear.toString() === selectedYear && 
          entryMonth.toString() === selectedMonth
        );
      }
      
      // Fallback: parse from created timestamp if month/day fields don't exist
      if (group.entry.created) {
        try {
          // Handle the timestamp format that includes random suffix
          // Format: "2025-01-06T03:43:47.677Z-u38k53"
          const lastDashIndex = group.entry.created.lastIndexOf('-');
          if (lastDashIndex > 10) { // Make sure it's not a date dash
            const isoString = group.entry.created.substring(0, lastDashIndex);
            const date = new Date(isoString);
            if (!isNaN(date.getTime())) {
              const entryYear = date.getFullYear().toString();
              const entryMonth = (date.getMonth() + 1).toString(); // JS months are 0-indexed
              
              return (
                entryYear === selectedYear && 
                entryMonth === selectedMonth
              );
            }
          }
        } catch (e) {
          console.error('Error parsing date for filter:', group.entry.created, e);
        }
      }
      
      // If we can't determine the date, exclude from results
      return false;
    });
    
    console.log('TradesPage Filter:', groupedImages.length, '→', filtered.length, `(${selectedYear}-${selectedMonth})`);
    if (filtered.length === 0 && groupedImages.length > 0) {
      console.log('Filter debug - First group entry date info:', {
        month: groupedImages[0]?.entry.month,
        day: groupedImages[0]?.entry.day,
        year: groupedImages[0]?.entry.year,
        created: groupedImages[0]?.entry.created
      });
    }
    setFilteredGroups(filtered);
  }, [groupedImages, selectedYear, selectedMonth]);

  // Month names for the picker
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", 
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  return (
    <div className="w-full min-h-screen bg-black pt-20 px-4 sm:px-8 relative" style={{ zIndex: 0 }}>
      {/* Filter Button */}
      <div className="flex justify-end mb-4">
        <button 
          onClick={() => setShowFilter(!showFilter)}
          className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white p-2 rounded-lg transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
      
      {/* Filter Panel */}
      <AnimatePresence>
        {showFilter && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-neutral-900 rounded-xl p-6 mb-6 border border-neutral-700 shadow-xl"
          >
            <div className="flex flex-col md:flex-row gap-8 items-center">
              {/* Year Input */}
              <div className="w-full md:w-1/3">
                <label className="block text-neutral-400 mb-2 font-medium">Year</label>
                <input
                  type="number"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full bg-neutral-800 text-white border border-neutral-600 rounded-lg px-4 py-3 text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="2000"
                  max="2100"
                />
              </div>
              
              {/* Month Picker */}
              <div className="w-full md:w-2/3">
                <label className="block text-neutral-400 mb-2 font-medium">Month</label>
                <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                  {monthNames.map((month, index) => (
                    <motion.button
                      key={index}
                      type="button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedMonth((index + 1).toString())}
                      className={`rounded-full w-16 h-16 flex items-center justify-center text-lg font-medium transition-all ${
                        selectedMonth === (index + 1).toString()
                          ? 'bg-blue-600 text-white shadow-lg'
                          : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                      }`}
                    >
                      {month}
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <div className="max-w-full overflow-y-auto" style={{ height: 'calc(100vh - 80px)' }}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7 }}
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6 sm:gap-12 w-full pb-8"
        >
        {groupedImages.length === 0 && (
          <div className="flex flex-col items-center justify-center col-span-full py-24">
            <Spinner size={48} />
            <div className="text-2xl font-bold text-[#e5e5e5] mb-2 mt-8">No trades yet!</div>
            <div className="text-lg text-green-400">Welcome to your trading journal. Add your first trade!</div>
          </div>
        )}
        {filteredGroups.length === 0 && groupedImages.length > 0 && (
          <div className="flex flex-col items-center justify-center col-span-full py-24">
            <div className="text-2xl font-bold text-[#e5e5e5] mb-2">No entries for {monthNames[parseInt(selectedMonth) - 1]} {selectedYear}</div>
            <div className="text-lg text-blue-400">Try selecting a different month or year</div>
          </div>
        )}
        {filteredGroups.map((group, groupIdx) => (
          <Tilt
            key={groupIdx}
            glareEnable={true}
            glareMaxOpacity={0.15}
            glareColor="#fff"
            glarePosition="all"
            tiltMaxAngleX={10}
            tiltMaxAngleY={10}
            scale={1.03}
            transitionSpeed={600}
            className="relative"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.08 }}
              transition={{ duration: 0.3, delay: groupIdx * 0.03 }}
              className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 flex flex-col items-center border border-white/20 shadow-xl cursor-pointer group w-full h-full min-h-[280px]"
            >
              {/* Deposit/Payout or Screenshot Content */}
              {group.isDeposit ? (
                // Deposit placeholder
                <div 
                  className="relative w-full aspect-square bg-black/80 rounded-xl flex items-center justify-center cursor-pointer"
                  onClick={() => openEntryDetails(group.entry)}
                >
                  <div className="text-4xl font-bold text-blue-400">$</div>
                </div>
              ) : group.isPayout ? (
                // Payout placeholder
                <div 
                  className="relative w-full aspect-square bg-black/80 rounded-xl flex items-center justify-center cursor-pointer"
                  onClick={() => openEntryDetails(group.entry)}
                >
                  <div className="text-4xl font-bold text-red-400">$</div>
                </div>
              ) : group.totalImages > 0 ? (
                // Regular screenshot entry
                <>
                  {/* Favorite Star */}
                  <button
                    className="absolute top-4 right-4 z-10"
                    onClick={e => { e.stopPropagation(); toggleFavorite(group.firstImage.src); }}
                    aria-label={favorites[group.firstImage?.src] ? 'Unfavorite' : 'Favorite'}
                    style={{ background: 'rgba(0,0,0,0.5)', borderRadius: '9999px', padding: 4 }}
                  >
                    <motion.span
                      initial={{ scale: 0.8 }}
                      animate={{ scale: favorites[group.firstImage?.src] ? 1.2 : 1 }}
                      transition={{ type: 'spring', stiffness: 400 }}
                    >
                      <StarIcon className={`w-6 h-6 sm:w-8 sm:h-8 ${favorites[group.firstImage?.src] ? 'text-yellow-400' : 'text-gray-400'}`} />
                    </motion.span>
                  </button>

                  {/* Images Container */}
                  <div className="relative w-full aspect-square">
                    {group.totalImages === 1 ? (
                      // Single image - no stacking animation
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ 
                          duration: 0.4, 
                          delay: groupIdx * 0.1,
                          type: 'spring',
                          stiffness: 200
                        }}
                      >
                        <motion.img
                          src={group.firstImage.src}
                          alt="Trade Screenshot"
                          className="w-full aspect-square object-cover rounded-xl border-2 border-white/10 shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:shadow-2xl"
                          whileHover={{ 
                            scale: 1.12,
                            zIndex: 50
                          }}
                          transition={{ type: 'spring', stiffness: 300 }}
                          onClick={() => {
                            openImageViewer(group.firstImage, group.entry);
                          }}
                          style={{ cursor: "pointer" }}
                        />
                      </motion.div>
                    ) : (
                      // Multiple images - stacked animation
                      <div className="relative w-full h-full">
                        {group.images.map((img, imgIdx) => (
                          <motion.div
                            key={imgIdx}
                            className="absolute inset-0"
                            initial={{ 
                              opacity: 0,
                              scale: 0.95
                            }}
                            animate={{ 
                              opacity: 1,
                              scale: 1
                            }}
                            transition={{ 
                              duration: 0.4, 
                              delay: groupIdx * 0.1 + imgIdx * 0.1,
                              type: 'spring',
                              stiffness: 200
                            }}
                            style={{
                              transform: `translate(${imgIdx * 6}px, ${imgIdx * 6}px)`,
                              zIndex: group.images.length - imgIdx
                            }}
                          >
                            <motion.img
                              src={img.src}
                              alt="Trade Screenshot"
                              className="w-full aspect-square object-cover rounded-xl border-2 border-white/10 shadow-lg"
                              whileHover={{ 
                                scale: 1.1,
                                zIndex: 50,
                                boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.4)'
                              }}
                              transition={{ type: 'spring', stiffness: 300 }}
                              onClick={() => {
                                openImageViewer(img, group.entry);
                              }}
                              style={{ cursor: "pointer" }}
                            />
                          </motion.div>
                        ))}
                        
                        {/* Image Count Badge */}
                        <motion.div 
                          className="absolute top-2 left-2 z-20 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full px-3 py-1 text-sm font-bold shadow-lg"
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ 
                            delay: groupIdx * 0.1 + group.totalImages * 0.1 + 0.2,
                            type: 'spring',
                            stiffness: 300
                          }}
                          whileHover={{ scale: 1.1 }}
                        >
                          {group.totalImages}
                        </motion.div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                // Trade/Tape reading without screenshots - show placeholder
                <div 
                  className="relative w-full aspect-square bg-black/80 rounded-xl flex items-center justify-center cursor-pointer"
                  onClick={() => openEntryDetails(group.entry)}
                >
                  <div className="text-4xl font-bold text-neutral-400">
                    {group.isTapeReading ? '📊' : '📈'}
                  </div>
                </div>
              )}

              {/* Title and Date */}
              <div className="mt-auto pt-2 text-center w-full">
                <div className="text-sm text-white/90 font-medium mb-1 h-[40px] flex items-center justify-center overflow-hidden">
                  <div className="truncate max-w-full px-1 leading-tight" title={group.entry.title || ''}>
                    {group.entry.title || ''}
                  </div>
                </div>
                <div className="text-xs text-neutral-500 h-[16px] flex items-center justify-center">
                  {(() => {
                    // Try to use month/day fields first (more reliable)
                    if (group.entry && group.entry.month && group.entry.day) {
                      const year = group.entry.year || new Date().getFullYear();
                      const month = parseInt(group.entry.month) - 1; // JS months are 0-indexed
                      const day = parseInt(group.entry.day);
                      const date = new Date(year, month, day);
                      if (!isNaN(date.getTime())) {
                        return date.toLocaleDateString();
                      }
                    }
                    
                    // Fallback to parsing created timestamp
                    if (group.entry.created) {
                      try {
                        // Handle the timestamp format that includes random suffix
                        // Format: "2025-01-06T03:43:47.677Z-u38k53"
                        const lastDashIndex = group.entry.created.lastIndexOf('-');
                        if (lastDashIndex > 10) { // Make sure it's not a date dash
                          const isoString = group.entry.created.substring(0, lastDashIndex);
                          const date = new Date(isoString);
                          if (!isNaN(date.getTime())) {
                            return date.toLocaleDateString();
                          }
                        }
                      } catch (e) {
                        console.error('Error parsing date:', e);
                      }
                    }
                    
                    return 'Invalid Date';
                  })()}
                </div>
              </div>
            </motion.div>
          </Tilt>
        ))}
      </motion.div>
      </div>

      {/* Image Viewer Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-between z-50 overflow-hidden"
            onClick={closeImageViewer}
            onMouseMove={(e) => {
              // Show trade details when mouse is in the right 20% of the screen
              const rightThreshold = window.innerWidth * 0.8;
              if (e.clientX > rightThreshold) {
                setShowTradeDetails(true);
              } else {
                setShowTradeDetails(false);
              }
            }}
            onMouseLeave={() => setShowTradeDetails(false)}
          >
            {/* Close Button */}
            <button
              onClick={closeImageViewer}
              className="absolute top-4 right-4 z-50 bg-black bg-opacity-90 text-white rounded-full p-3 hover:bg-opacity-100 hover:scale-110 transition-all duration-200 shadow-lg border border-white/20"
            >
              <XMarkIcon className="w-7 h-7" />
            </button>



            {/* Image Container with Navigation */}
            <div className="flex items-center justify-center w-full h-full relative">
              {/* Navigation arrows - always show */}
              <button
                onClick={e => { e.stopPropagation(); navigateImage('prev'); }}
                className="absolute left-6 z-50 bg-black bg-opacity-90 text-white rounded-full p-4 hover:bg-opacity-100 hover:scale-110 transition-all duration-200 shadow-lg border border-white/20"
              >
                <ChevronLeftIcon className="w-10 h-10" />
              </button>

              <button
                onClick={e => { e.stopPropagation(); navigateImage('next'); }}
                className="absolute right-6 z-50 bg-black bg-opacity-90 text-white rounded-full p-4 hover:bg-opacity-100 hover:scale-110 transition-all duration-200 shadow-lg border border-white/20"
              >
                <ChevronRightIcon className="w-10 h-10" />
              </button>

              {/* Content - either image or placeholder */}
              {selectedImage.src ? (
                /* Image */
                <motion.img
                  src={selectedImage.src}
                  alt="Trade Screenshot"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="w-full h-full object-cover"
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                /* Placeholder for deposits/payouts/trades without images */
                <motion.div 
                  className="w-64 h-64 rounded-xl flex items-center justify-center"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                >
                  {tradeEntry.isDeposit ? (
                    <div className="text-8xl font-bold text-blue-400">$</div>
                  ) : tradeEntry.isPayout ? (
                    <div className="text-8xl font-bold text-red-400">$</div>
                  ) : tradeEntry.tapeReading ? (
                    <div className="text-8xl font-bold text-neutral-400">📊</div>
                  ) : (
                    <div className="text-8xl font-bold text-neutral-400">📈</div>
                  )}
                </motion.div>
              )}
            </div>

            {/* Trade Details Panel - Slides in from right on hover */}
            <motion.div
              initial={{ x: 320 }}
              animate={{ x: showTradeDetails ? 0 : 320 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              onClick={e => e.stopPropagation()}
              className="absolute right-0 top-0 w-80 h-full bg-neutral-900 bg-opacity-95 backdrop-blur-md p-4 overflow-y-auto border-l border-white/20"
            >
              <h3 className="text-xl font-bold text-[#e5e5e5] mb-4">
                {tradeEntry.isDeposit ? 'Deposit Details' : 
                 tradeEntry.isPayout ? 'Payout Details' :
                 tradeEntry.tapeReading ? 'Tape Reading Details' : 'Trade Details'}
              </h3>
              <div className="space-y-3">
                {/* Title */}
                {tradeEntry.title && (
                  <div>
                    <span className="text-sm text-neutral-400">Title:</span>
                    <div className="text-[#e5e5e5] font-semibold">{tradeEntry.title}</div>
                  </div>
                )}
                
                {/* Date */}
                <div>
                  <span className="text-sm text-neutral-400">Date:</span>
                  <div className="text-[#e5e5e5] font-semibold">
                    {new Date(tradeEntry.created).toLocaleDateString()}
                  </div>
                </div>
                
                {/* Ticker (Trade only) */}
                {tradeEntry.tickerTraded && !tradeEntry.isDeposit && !tradeEntry.isPayout && (
                  <div>
                    <span className="text-sm text-neutral-400">Ticker:</span>
                    <div className="text-[#e5e5e5] font-semibold">{tradeEntry.tickerTraded}</div>
                  </div>
                )}
                
                {/* Amount/P&L */}
                {tradeEntry.pnl != null && (
                  <div>
                    <span className="text-sm text-neutral-400">
                      {tradeEntry.isDeposit ? 'Deposit Amount:' : 
                       tradeEntry.isPayout ? 'Payout Amount:' : 'P&L:'}
                    </span>
                    <div className={`font-semibold ${
                      tradeEntry.isDeposit ? 'text-blue-400' : 
                      tradeEntry.isPayout ? 'text-red-400' : 
                      Number(tradeEntry.pnl) > 0 ? 'text-green-400' : 
                      Number(tradeEntry.pnl) < 0 ? 'text-red-400' : 'text-[#e5e5e5]'
                    }`}>
                      {tradeEntry.isPayout ? 
                        `$${Math.abs(Number(tradeEntry.pnl)).toFixed(2)}` : 
                        `${Number(tradeEntry.pnl) > 0 ? '+' : ''}${Number(tradeEntry.pnl).toFixed(2)}`
                      }
                    </div>
                  </div>
                )}
                
                {/* Account Balance (Deposit/Payout only) */}
                {(tradeEntry.isDeposit || tradeEntry.isPayout) && tradeEntry.accountBalance != null && (
                  <div>
                    <span className="text-sm text-neutral-400">Account Balance:</span>
                    <div className="text-[#e5e5e5] font-semibold">${Number(tradeEntry.accountBalance).toFixed(2)}</div>
                  </div>
                )}
                
                {/* R:R (Trade only) */}
                {tradeEntry.rr && !tradeEntry.isDeposit && !tradeEntry.isPayout && (
                  <div>
                    <span className="text-sm text-neutral-400">R:R:</span>
                    <div className="text-[#e5e5e5] font-semibold">{tradeEntry.rr}</div>
                  </div>
                )}
                
                {/* Notes */}
                {tradeEntry.notes && (
                  <div>
                    <span className="text-sm text-neutral-400">Notes:</span>
                    <div className="text-[#e5e5e5] text-sm mt-1">{tradeEntry.notes}</div>
                  </div>
                )}
              </div>
              
              {/* Go to Day button */}
              {tradeEntry.month && tradeEntry.day && (
                <button
                  onClick={goToDay}
                  className="w-full mt-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white py-3 rounded-lg font-semibold transition-all shadow-lg"
                >
                  Go to Day
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TradesPage; 