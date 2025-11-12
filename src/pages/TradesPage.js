import React, { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Tilt from "react-parallax-tilt";
import { StarIcon, PlusIcon, ChevronLeftIcon, ChevronRightIcon, XMarkIcon, InformationCircleIcon } from '@heroicons/react/24/solid';
import { UserContext } from "../App";
import { useHeader } from "../components/Layout";
import { db } from '../firebase';
import { collection, getDocs, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import Spinner from '../components/MatrixLoader';

const TradesPage = () => {
  const { user, currentUser, selectedAccount, dataRefreshTrigger } = useContext(UserContext);
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
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());
  const [filteredGroups, setFilteredGroups] = useState([]);
  const [showFilter, setShowFilter] = useState(false);
  const [showAllTrades, setShowAllTrades] = useState(false);
  
  const navigate = useNavigate();

  // Function to delete a trade from all accounts and orphaned entries
  const deleteTrade = async (entry) => {
    if (!currentUser || !entry) return;
    
    try {
      // If entry is orphaned, delete from orphanedEntries collection
      if (entry.isOrphaned) {
        const orphanedDoc = doc(db, 'users', currentUser.uid, 'orphanedEntries', entry.id);
        await deleteDoc(orphanedDoc);
        console.log('✅ Deleted orphaned entry');
      } else {
        // Get all accounts for the current user
        const accountsCol = collection(db, 'users', currentUser.uid, 'accounts');
        const accountsSnap = await getDocs(accountsCol);
        const accounts = accountsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Delete the entry from all accounts where it exists
        const deletePromises = accounts.map(async (account) => {
          const entryDoc = doc(db, 'users', currentUser.uid, 'accounts', account.id, 'entries', entry.id);
          try {
            await deleteDoc(entryDoc);
            console.log(`✅ Deleted entry from account: ${account.name}`);
          } catch (error) {
            // Entry might not exist in this account, that's okay
            console.log(`ℹ️ Entry not found in account: ${account.name}`);
          }
        });
        
        await Promise.all(deletePromises);
        console.log('✅ Trade deleted from all accounts successfully');
      }
      
      // Update local state instead of refreshing the page
      setGroupedImages(prev => prev.filter(group => group.entry.id !== entry.id));
      setAllImages(prev => prev.filter(item => item.entry.id !== entry.id));
      setAllEntries(prev => prev.filter(item => item.id !== entry.id));
      
      // Close any open modals if the deleted entry was being viewed
      if (selectedImage && selectedImage.entry && selectedImage.entry.id === entry.id) {
        closeImageViewer();
      }
    } catch (error) {
      console.error('❌ Error deleting trade:', error);
      alert('Failed to delete trade. Please try again.');
    }
  };

  useEffect(() => {
    if (!currentUser || !selectedAccount) return;
    const fetchData = async () => {
      // Using static imports from the top of the file
      
      // TRADES & TAPE READINGS: Fetch from ALL accounts (cross-account)
      let allTradesAndTapeReadings = [];
      
      // Get all accounts for the current user
      const accountsCol = collection(db, 'users', currentUser.uid, 'accounts');
      const accountsSnap = await getDocs(accountsCol);
      const accounts = accountsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Fetch trades and tape readings from each account
      for (const account of accounts) {
        const entriesCol = collection(db, 'users', currentUser.uid, 'accounts', account.id, 'entries');
        const snap = await getDocs(entriesCol);
        const accountEntries = snap.docs
          .map(doc => ({ 
            ...doc.data(), 
            id: doc.id,
            accountId: account.id,
            accountName: account.name
          }))
          .filter(entry => !entry.isDeposit && !entry.isPayout); // Only trades and tape readings
        allTradesAndTapeReadings.push(...accountEntries);
      }
      
      // Fetch orphaned entries (from deleted accounts)
      try {
        const orphanedCol = collection(db, 'users', currentUser.uid, 'orphanedEntries');
        const orphanedSnap = await getDocs(orphanedCol);
        const orphanedEntries = orphanedSnap.docs
          .map(doc => ({ 
            ...doc.data(), 
            id: doc.id,
            accountId: doc.data().originalAccountId || 'deleted',
            accountName: doc.data().originalAccountName || 'Deleted Account',
            isOrphaned: true
          }))
          .filter(entry => !entry.isDeposit && !entry.isPayout); // Only trades and tape readings
        allTradesAndTapeReadings.push(...orphanedEntries);
      } catch (error) {
        console.log('No orphaned entries found or error fetching:', error);
      }
      
      // DEPOSITS & PAYOUTS: Fetch from ONLY the selected account (account-specific)
      let selectedAccountDepositsPayouts = [];
      if (selectedAccount) {
        const selectedEntriesCol = collection(db, 'users', currentUser.uid, 'accounts', selectedAccount.id, 'entries');
        const selectedSnap = await getDocs(selectedEntriesCol);
        selectedAccountDepositsPayouts = selectedSnap.docs
          .map(doc => ({ 
            ...doc.data(), 
            id: doc.id,
            accountId: selectedAccount.id,
            accountName: selectedAccount.name
          }))
          .filter(entry => entry.isDeposit || entry.isPayout); // Only deposits and payouts
      }
      
      // Combine all entries
      const allEntries = [...allTradesAndTapeReadings, ...selectedAccountDepositsPayouts];
      
      // Sort all entries by creation date (newest first)
      allEntries.sort((a, b) => {
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
      
      // Fetch favorites (use a shared favorites collection for all accounts)
      const favDoc = await getDoc(doc(db, 'favorites', currentUser.uid + '_shared'));
      setFavorites(favDoc.exists() ? favDoc.data().data : {});
      
      // Build grouped images array AND navigation array
      const grouped = [];
      const allImagesArray = []; // For navigation - contains individual images AND placeholder entries
      
      allEntries.forEach(entry => {
        console.log(`Processing entry: ${entry.title || 'Untitled'} - Screenshots: ${entry.screenshots?.length || 0}, Images: ${entry.images?.length || 0}, Image: ${entry.image ? 'Yes' : 'No'}, Month: ${entry.month}, Day: ${entry.day}, isResetExcluded: ${entry.isResetExcluded}`);
        
        // Normalize image data - handle different ways images might be stored
        let imageArray = [];
        
        if (entry.screenshots && entry.screenshots.length) {
          imageArray = [...entry.screenshots];
        } else if (entry.images && entry.images.length) {
          imageArray = [...entry.images];
        } else if (entry.imageUrls && entry.imageUrls.length) {
          imageArray = [...entry.imageUrls];
        } else if (entry.image) {
          imageArray = [entry.image];
        } else if (entry.screenshot) {
          imageArray = [entry.screenshot];
        } else if (entry.imageUrl) {
          imageArray = [entry.imageUrl];
        }
        
        // For entries with images (any format)
        if (imageArray.length > 0) {
          console.log(`📸 Found ${imageArray.length} images for entry: ${entry.title || 'Untitled'}`);
          
          const entryImages = imageArray.map((src, imageIndex) => ({
            src,
            created: entry.created,
            entry: entry,
            link: entry.month && entry.day ? `/day/${entry.month}/${entry.day}` : '#',
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
            link: entry.month && entry.day ? `/day/${entry.month}/${entry.day}` : '#',
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
        // For trades/tape readings without any images (still show them with placeholder)
        else if (!entry.isDeposit && !entry.isPayout) {
          const placeholderItem = {
            src: null,
            created: entry.created,
            entry: entry,
            link: entry.month && entry.day ? `/day/${entry.month}/${entry.day}` : '#',
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
      console.log('TradesPage - Cross-account trades/tape readings:', allTradesAndTapeReadings.length, 'Selected account deposits/payouts:', selectedAccountDepositsPayouts.length, 'Total combined:', allEntries.length, 'Grouped:', grouped.length);
      console.log('TradesPage - Entries with screenshots:', allEntries.filter(e => e.screenshots && e.screenshots.length > 0).length);
      
      // Debug: Log all entries to help find TGIF MBT
      console.log('🔍 All entries being processed:');
      allEntries.forEach((entry, index) => {
        console.log(`Entry ${index}:`, {
          title: entry.title,
          month: entry.month,
          day: entry.day,
          year: entry.year,
          created: entry.created,
          accountName: entry.accountName,
          isDeposit: entry.isDeposit,
          isPayout: entry.isPayout,
          tapeReading: entry.tapeReading
        });
      });
      
      // DEBUGGING: Check for old image entries that might be stored differently
      console.log('🔍 DEBUGGING - All entries with any image-related fields:');
      let foundOldImages = 0;
      
      allEntries.forEach((entry, index) => {
        // Check for any possible image field
        const hasAnyImages = entry.screenshots || entry.images || entry.image || entry.screenshot || entry.imageUrl || entry.imageUrls;
        
        if (hasAnyImages) {
          foundOldImages++;
          console.log(`Entry ${index} - ${entry.title || 'Untitled'}:`, {
            screenshots: entry.screenshots,
            images: entry.images,
            image: entry.image,
            screenshot: entry.screenshot,
            imageUrl: entry.imageUrl,
            imageUrls: entry.imageUrls,
            title: entry.title,
            created: entry.created,
            isResetExcluded: entry.isResetExcluded,
            accountName: entry.accountName,
            // Show all fields to see if there are other image-related fields
            allFields: Object.keys(entry).filter(key => key.toLowerCase().includes('image') || key.toLowerCase().includes('screenshot') || key.toLowerCase().includes('photo') || key.toLowerCase().includes('pic'))
          });
        }
      });
      
      console.log(`🔍 DEBUGGING - Found ${foundOldImages} entries with image data out of ${allEntries.length} total entries`);
      
      // If we found old images with different field names, log a helpful message
      if (foundOldImages > 0) {
        console.log('✅ Good news! Found entries with image data. They should now be visible on the TradesPage.');
      }
      
      console.log('TradesPage - Sample entry:', allEntries[0] ? {
        screenshots: allEntries[0].screenshots,
        screenshotsLength: allEntries[0].screenshots?.length,
        isDeposit: allEntries[0].isDeposit,
        isPayout: allEntries[0].isPayout,
        tapeReading: allEntries[0].tapeReading,
        created: allEntries[0].created,
        month: allEntries[0].month,
        day: allEntries[0].day,
        accountName: allEntries[0].accountName
      } : 'No entries');
      
      setGroupedImages(grouped);
      setAllImages(allImagesArray);
      setAllEntries(allEntries); // Store all entries for navigation
    };
    fetchData();
  }, [currentUser, selectedAccount, dataRefreshTrigger]); // Include selectedAccount since deposits/payouts are account-specific



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
    await setDoc(doc(db, 'favorites', currentUser.uid + '_shared'), { data: sanitized });
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
    
    // If showAllTrades is enabled, show all trades regardless of date
    if (showAllTrades) {
      setFilteredGroups(groupedImages);
      return;
    }
    
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
      
      // If we can't determine the date, include it in the current month/year view
      // This ensures trades like "TGIF MBT" that might have date parsing issues still show up
      console.log('Including trade with unclear date:', group.entry.title || 'Untitled', 'in current month view');
      return true;
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
  }, [groupedImages, selectedYear, selectedMonth, showAllTrades]);

  // Month names for the picker
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", 
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  const yearOptions = [];
  for (let y = currentYear - 3; y <= currentYear + 2; y++) yearOptions.push(y);

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
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full bg-neutral-800 text-white border border-neutral-600 rounded-lg px-4 py-3 text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {yearOptions.map(year => (
                    <option key={year} value={year.toString()}>{year}</option>
                  ))}
                </select>
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
              
              {/* Show All Trades Toggle */}
              <div className="w-full md:w-full mt-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showAllTrades}
                    onChange={(e) => setShowAllTrades(e.target.checked)}
                    className="w-5 h-5 text-blue-600 bg-neutral-800 border-neutral-600 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <span className="text-neutral-400 font-medium">Show All Trades (Ignore Date Filter)</span>
                </label>
                {showAllTrades && (
                  <div className="text-sm text-blue-400 mt-2">
                    Showing all trades regardless of month/year selection
                  </div>
                )}
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
            <div className="text-lg text-blue-400 mb-4">Try selecting a different month or year, or use "Show All Trades" to see all entries</div>
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  setSelectedYear(new Date().getFullYear().toString());
                  setSelectedMonth((new Date().getMonth() + 1).toString());
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-semibold transition-all"
              >
                Reset to Current Month
              </button>
              <button 
                onClick={() => setShowAllTrades(true)}
                className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-lg font-semibold transition-all"
              >
                Show All Trades
              </button>
            </div>
          </div>
        )}
        {filteredGroups.map((group, groupIdx) => (
          <AnimatePresence key={group.entry.id}>
            <Tilt
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
                exit={{ opacity: 0, scale: 0.8, y: -20 }}
                whileHover={{ scale: 1.08 }}
                transition={{ duration: 0.3, delay: groupIdx * 0.03 }}
                className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 flex flex-col items-center border border-white/20 shadow-xl cursor-pointer group w-full h-full min-h-[280px]"
              >
              {/* Deposit/Payout or Trade/TapeReading Content */}
              {group.isDeposit ? (
                // Deposit placeholder
                <div 
                  className="relative w-full aspect-square bg-black/80 rounded-xl flex items-center justify-center cursor-pointer"
                  onClick={() => openEntryDetails(group.entry)}
                >
                  <div className="text-4xl font-bold text-blue-400">$</div>
                  
                  {/* Delete Button for deposits */}
                  <button
                    className="absolute top-2 left-2 z-10"
                    onClick={e => { e.stopPropagation(); deleteTrade(group.entry); }}
                    aria-label="Delete deposit"
                    style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '9999px', padding: 3 }}
                  >
                    <motion.span
                      initial={{ scale: 0.8 }}
                      whileHover={{ scale: 1.1 }}
                      transition={{ type: 'spring', stiffness: 400 }}
                    >
                      <XMarkIcon className="w-4 h-4 text-neutral-400 hover:text-neutral-300" />
                    </motion.span>
                  </button>
                </div>
              ) : group.isPayout ? (
                // Payout placeholder
                <div 
                  className="relative w-full aspect-square bg-black/80 rounded-xl flex items-center justify-center cursor-pointer"
                  onClick={() => openEntryDetails(group.entry)}
                >
                  <div className="text-4xl font-bold text-red-400">$</div>
                  
                  {/* Delete Button for payouts */}
                  <button
                    className="absolute top-2 left-2 z-10"
                    onClick={e => { e.stopPropagation(); deleteTrade(group.entry); }}
                    aria-label="Delete payout"
                    style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '9999px', padding: 3 }}
                  >
                    <motion.span
                      initial={{ scale: 0.8 }}
                      whileHover={{ scale: 1.1 }}
                      transition={{ type: 'spring', stiffness: 400 }}
                    >
                      <XMarkIcon className="w-4 h-4 text-neutral-400 hover:text-neutral-300" />
                    </motion.span>
                  </button>
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

                  {/* Delete Button */}
                  <button
                    className="absolute top-2 left-2 z-10"
                    onClick={e => { e.stopPropagation(); deleteTrade(group.entry); }}
                    aria-label="Delete trade"
                    style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '9999px', padding: 3 }}
                  >
                    <motion.span
                      initial={{ scale: 0.8 }}
                      whileHover={{ scale: 1.1 }}
                      transition={{ type: 'spring', stiffness: 400 }}
                    >
                      <XMarkIcon className="w-4 h-4 text-neutral-400 hover:text-neutral-300" />
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
                        
                        {/* Image Count Badge - moved to bottom to avoid overlap with star icon */}
                        <motion.div 
                          className="absolute bottom-2 left-2 z-20 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full px-3 py-1 text-sm font-bold shadow-lg"
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
                  
                  {/* Delete Button for placeholder trades */}
                  <button
                    className="absolute top-2 left-2 z-10"
                    onClick={e => { e.stopPropagation(); deleteTrade(group.entry); }}
                    aria-label="Delete trade"
                    style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '9999px', padding: 3 }}
                  >
                    <motion.span
                      initial={{ scale: 0.8 }}
                      whileHover={{ scale: 1.1 }}
                      transition={{ type: 'spring', stiffness: 400 }}
                    >
                      <XMarkIcon className="w-4 h-4 text-neutral-400 hover:text-neutral-300" />
                    </motion.span>
                  </button>
                </div>
              )}

              {/* Title, Date, and Account */}
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
                {/* Account information */}
                {group.entry.accountName && (
                  <div className="text-xs text-blue-400 h-[16px] flex items-center justify-center mt-1">
                    {group.entry.accountName}
                  </div>
                )}
              </div>
            </motion.div>
          </Tilt>
        </AnimatePresence>
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
                
                {/* Account */}
                {tradeEntry.accountName && (
                  <div>
                    <span className="text-sm text-neutral-400">Account:</span>
                    <div className="text-blue-400 font-semibold">{tradeEntry.accountName}</div>
                  </div>
                )}
                
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
                        tradeEntry.isDeposit ?
                        `$${Number(tradeEntry.pnl).toFixed(2)}` :
                        `${Number(tradeEntry.pnl) > 0 ? '+' : ''}$${Number(tradeEntry.pnl).toFixed(2)}`
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
              
              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                {tradeEntry.month && tradeEntry.day && (
                  <button
                    onClick={goToDay}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white py-3 rounded-lg font-semibold transition-all shadow-lg"
                  >
                    Go to Day
                  </button>
                )}
                
                <button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete this entry? This action cannot be undone and will delete it from all accounts.')) {
                      deleteTrade(tradeEntry);
                    }
                  }}
                  className="px-6 py-3 bg-neutral-600 hover:bg-neutral-500 text-white rounded-lg font-semibold transition-all shadow-lg"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TradesPage; 