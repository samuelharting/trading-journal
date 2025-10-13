import React, { useState, useEffect, useRef, useContext } from "react";
import { PlusIcon, TrashIcon, PencilIcon, PhotoIcon, XMarkIcon, ChevronDownIcon, ChevronRightIcon, MagnifyingGlassIcon, ClockIcon, SwatchIcon, FolderIcon } from '@heroicons/react/24/solid';
import { BookOpenIcon, ChevronDoubleRightIcon, ChevronDoubleLeftIcon } from '@heroicons/react/24/outline';
import { UserContext } from '../App';
import { storage, db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Notebook data is stored at the user level (not account level) so it's shared across all accounts
function getNotebookKey(user) { return `notebookData-${user || 'default'}`; }
function getSectionKey(user) { return `notebookSelectedSection-${user || 'default'}`; }
function getPageKey(user) { return `notebookSelectedPage-${user || 'default'}`; }
function getRecentKey(user) { return `notebookRecent-${user || 'default'}`; }
function getSidebarExpandedKey(user) { return `notebookSidebarExpanded-${user || 'default'}`; }

// Color palette for sections
const SECTION_COLORS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#10b981' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Gray', value: '#6b7280' },
];

function loadNotebook(user) {
  if (!user) {
    console.log('[NOTEBOOK] loadNotebook: No user provided, returning empty array');
    return [];
  }
  
  const key = getNotebookKey(user);
  let data;
  try {
    const stored = localStorage.getItem(key);
    console.log('[NOTEBOOK] loadNotebook: Raw stored data:', stored);
    data = stored ? JSON.parse(stored) : [];
    if (!Array.isArray(data)) {
      console.warn('[NOTEBOOK] loadNotebook: Data is not an array, resetting to empty array');
      data = [];
    }
  } catch (error) {
    console.error('[NOTEBOOK] loadNotebook: Error parsing data:', error);
    data = [];
  }
  console.log('[NOTEBOOK] loadNotebook:', { user, key, dataLength: data.length, data });
  return data;
}

async function saveNotebook(user, data) {
  if (!user) {
    console.error('[NOTEBOOK] saveNotebook: No user provided, cannot save');
    return;
  }
  
  const key = getNotebookKey(user);
  try {
    const payload = { sections: data, updatedAt: Date.now() };
    const jsonData = JSON.stringify(payload.sections);
    localStorage.setItem(key, jsonData);
    localStorage.setItem(`${key}-updatedAt`, String(payload.updatedAt));
    console.log('[NOTEBOOK] saveNotebook:', { user, key, dataLength: data.length, updatedAt: payload.updatedAt });
    
    // Verify the save worked
    const verify = localStorage.getItem(key);
    if (verify !== jsonData) {
      console.error('[NOTEBOOK] saveNotebook: Save verification failed!');
    } else {
      console.log('[NOTEBOOK] saveNotebook: Save verified successfully');
    }

    // Persist to Firestore (user-level)
    try {
      const userDocRef = doc(db, 'notebooks', user);
      await setDoc(userDocRef, payload, { merge: true });
      console.log('[NOTEBOOK] Firestore save complete');
    } catch (err) {
      console.error('[NOTEBOOK] Firestore save error:', err);
    }
  } catch (error) {
    console.error('[NOTEBOOK] saveNotebook: Error saving data:', error);
  }
}

export default function NotebookPage() {
  const { currentUser } = useContext(UserContext);
  console.log('[NOTEBOOK] NotebookPage user:', currentUser);
  
  // Initialize sections from localStorage for the current user
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [selectedPage, setSelectedPage] = useState(null);
  const [editingSection, setEditingSection] = useState(null);
  const [editingPage, setEditingPage] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const editorRef = useRef();
  
  // New feature states
  const [searchQuery, setSearchQuery] = useState('');
  const [recentPages, setRecentPages] = useState([]);
  const [recentCollapsed, setRecentCollapsed] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(null);
  const [draggedPage, setDraggedPage] = useState(null);
  const [dragOverPageIndex, setDragOverPageIndex] = useState(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [draggedSection, setDraggedSection] = useState(null);
  
  // Sticky image states
  const [stickyImages, setStickyImages] = useState([]);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectionPosition, setSelectionPosition] = useState(null);
  const [loadingImages, setLoadingImages] = useState(new Set());
  const fileInputRef = useRef();

  // Load notebook data when user changes
  useEffect(() => {
    if (currentUser?.uid) {
      let loadedSections = loadNotebook(currentUser.uid);
      // Ensure sections have collapsed and color properties (backward compatibility)
      loadedSections = loadedSections.map(sec => ({
        ...sec,
        collapsed: sec.collapsed ?? false,
        color: sec.color ?? '#3b82f6',
        isFolder: sec.isFolder ?? false,
        parentId: sec.parentId ?? null
      }));
      
      const loadedSelectedSection = localStorage.getItem(getSectionKey(currentUser.uid));
      const loadedSelectedPage = localStorage.getItem(getPageKey(currentUser.uid));
      const localUpdatedAt = Number(localStorage.getItem(`${getNotebookKey(currentUser.uid)}-updatedAt`) || '0');
      
      // Load recent pages
      const recentData = localStorage.getItem(getRecentKey(currentUser.uid));
      const loadedRecent = recentData ? JSON.parse(recentData) : [];
      setRecentPages(loadedRecent);
      
      // Load sidebar expanded state
      const loadedSidebarExpanded = localStorage.getItem(getSidebarExpandedKey(currentUser.uid));
      setSidebarExpanded(loadedSidebarExpanded === 'true');

      setSections(loadedSections);
      setSelectedSection(loadedSelectedSection);
      setSelectedPage(loadedSelectedPage);

      console.log('[NOTEBOOK] Loaded local data for user:', currentUser.uid, {
        sections: loadedSections,
        selectedSection: loadedSelectedSection,
        selectedPage: loadedSelectedPage,
        localUpdatedAt,
        recentPages: loadedRecent
      });

      // Also load from Firestore and reconcile newest
      (async () => {
        try {
          const userDocRef = doc(db, 'notebooks', currentUser.uid);
          const snapshot = await getDoc(userDocRef);
          if (snapshot.exists()) {
            const remote = snapshot.data();
            let remoteSections = Array.isArray(remote?.sections) ? remote.sections : [];
            const remoteUpdatedAt = Number(remote?.updatedAt || 0);
            
            // Apply backward compatibility to remote data
            remoteSections = remoteSections.map(sec => ({
              ...sec,
              collapsed: sec.collapsed ?? false,
              color: sec.color ?? '#3b82f6',
              isFolder: sec.isFolder ?? false,
              parentId: sec.parentId ?? null
            }));

            if (remoteUpdatedAt > localUpdatedAt) {
              console.log('[NOTEBOOK] Using newer Firestore data');
              setSections(remoteSections);
              // Write back to localStorage for offline
              try {
                localStorage.setItem(getNotebookKey(currentUser.uid), JSON.stringify(remoteSections));
                localStorage.setItem(`${getNotebookKey(currentUser.uid)}-updatedAt`, String(remoteUpdatedAt));
              } catch (e) {
                console.warn('[NOTEBOOK] Failed to write Firestore data to localStorage', e);
              }
            } else {
              console.log('[NOTEBOOK] Local data is newer or equal; keeping local');
            }
          } else {
            console.log('[NOTEBOOK] No Firestore notebook yet for user');
          }
        } catch (err) {
          console.error('[NOTEBOOK] Error loading from Firestore:', err);
        }
      })();
    }
  }, [currentUser?.uid]);

  // Save to localStorage whenever sections change
  useEffect(() => {
    if (currentUser?.uid && sections.length > 0) {
      console.log('[NOTEBOOK] Sections changed, saving to localStorage');
      saveNotebook(currentUser.uid, sections);
    }
  }, [sections, currentUser?.uid]);

  // Force save every 5 seconds as backup
  useEffect(() => {
    if (!currentUser?.uid || sections.length === 0) return;
    
    const interval = setInterval(() => {
      console.log('[NOTEBOOK] Auto-saving notebook data...');
      saveNotebook(currentUser.uid, sections);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [sections, currentUser?.uid]);

  // Save on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentUser?.uid && sections.length > 0) {
        console.log('[NOTEBOOK] Page unloading, saving data...');
        saveNotebook(currentUser.uid, sections);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [sections, currentUser?.uid]);

  // Save selected section/page to localStorage
  useEffect(() => {
    if (currentUser?.uid) {
      if (selectedSection) {
        localStorage.setItem(getSectionKey(currentUser.uid), selectedSection);
        console.log('[NOTEBOOK] saveSelectedSection', { user: currentUser.uid, selectedSection });
      }
      if (selectedPage) {
        localStorage.setItem(getPageKey(currentUser.uid), selectedPage);
        console.log('[NOTEBOOK] saveSelectedPage', { user: currentUser.uid, selectedPage });
      }
    }
  }, [selectedSection, selectedPage, currentUser?.uid]);

  // Track recent pages
  useEffect(() => {
    if (currentUser?.uid && selectedSection && selectedPage) {
      const section = sections.find(s => s.id === selectedSection);
      const page = section?.pages.find(p => p.id === selectedPage);
      
      if (section && page) {
        setRecentPages(prev => {
          // Remove if already exists
          const filtered = prev.filter(r => !(r.sectionId === selectedSection && r.pageId === selectedPage));
          // Add to front
          const updated = [
            { sectionId: selectedSection, pageId: selectedPage, sectionName: section.name, pageName: page.name, timestamp: Date.now() },
            ...filtered
          ].slice(0, 5); // Keep only last 5
          
          // Save to localStorage
          localStorage.setItem(getRecentKey(currentUser.uid), JSON.stringify(updated));
          return updated;
        });
      }
    }
  }, [selectedSection, selectedPage, currentUser?.uid, sections]);

  // Section helpers
  const addSection = () => {
    const id = Date.now().toString();
    const newSection = { id, name: "Untitled Section", pages: [], collapsed: false, color: '#3b82f6', isFolder: false, parentId: null };
    setSections(s => [...s, newSection]);
    setSelectedSection(id);
    setSelectedPage(null);
    setEditingSection(id);
  };
  const addFolder = () => {
    const id = Date.now().toString();
    const newFolder = { 
      id, 
      name: "Untitled Folder", 
      pages: [], 
      collapsed: false, 
      color: '#3b82f6',
      isFolder: true,
      parentId: null
    };
    setSections(s => [...s, newFolder]);
    setEditingSection(id);
  };
  const deleteSection = (id) => {
    setSections(s => s.filter(sec => sec.id !== id));
    if (selectedSection === id) {
      setSelectedSection(null);
      setSelectedPage(null);
    }
  };
  const renameSection = (id, name) => {
    setSections(s => s.map(sec => sec.id === id ? { ...sec, name } : sec));
  };
  const toggleSectionCollapse = (id) => {
    setSections(s => s.map(sec => sec.id === id ? { ...sec, collapsed: !sec.collapsed } : sec));
  };
  const changeSectionColor = (id, color) => {
    setSections(s => s.map(sec => sec.id === id ? { ...sec, color } : sec));
    setColorPickerOpen(null);
  };

  // Page helpers
  const addPage = (sectionId) => {
    const id = Date.now().toString();
    setSections(s => s.map(sec =>
      sec.id === sectionId
        ? { ...sec, pages: [...sec.pages, { id, name: "Untitled Page", content: "" }] }
        : sec
    ));
    setSelectedSection(sectionId);
    setSelectedPage(id);
    setEditingPage(id);
  };
  const deletePage = (sectionId, pageId) => {
    setSections(s => s.map(sec =>
      sec.id === sectionId
        ? { ...sec, pages: sec.pages.filter(p => p.id !== pageId) }
        : sec
    ));
    if (selectedPage === pageId) setSelectedPage(null);
  };
  const renamePage = (sectionId, pageId, name) => {
    setSections(s => s.map(sec =>
      sec.id === sectionId
        ? { ...sec, pages: sec.pages.map(p => p.id === pageId ? { ...p, name } : p) }
        : sec
    ));
  };
  const setPageContent = (sectionId, pageId, content) => {
    setSections(s => {
      const updatedSections = s.map(sec =>
        sec.id === sectionId
          ? { ...sec, pages: sec.pages.map(p => p.id === pageId ? { ...p, content } : p) }
          : sec
      );
      
      // Save immediately when content changes
      if (currentUser?.uid) {
        console.log('[NOTEBOOK] Content changed, saving immediately...');
        saveNotebook(currentUser.uid, updatedSections);
      }
      
      return updatedSections;
    });
  };

  // Drag and drop helpers
  const handleDragStart = (e, sectionId, pageId, pageIndex) => {
    setDraggedPage({ sectionId, pageId, pageIndex });
    e.dataTransfer.effectAllowed = 'move';
  };
  
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  
  const handlePageDragOver = (e, sectionId, pageIndex) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPageIndex({ sectionId, pageIndex });
    e.dataTransfer.dropEffect = 'move';
  };
  
  const handlePageDrop = (e, targetSectionId, targetPageIndex) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPageIndex(null);
    
    if (!draggedPage) return;
    
    const sourceSection = sections.find(s => s.id === draggedPage.sectionId);
    const pageToMove = sourceSection?.pages[draggedPage.pageIndex];
    
    if (!pageToMove) return;
    
    if (draggedPage.sectionId === targetSectionId) {
      // REORDER within same section
      setSections(s => s.map(sec => {
        if (sec.id === targetSectionId) {
          const newPages = [...sec.pages];
          
          // Handle the case where we're moving within the same array
          if (draggedPage.pageIndex < targetPageIndex) {
            // Moving down: target index needs to be adjusted because we removed an item before it
            const adjustedTargetIndex = targetPageIndex - 1;
            newPages.splice(draggedPage.pageIndex, 1); // remove from old position
            newPages.splice(adjustedTargetIndex, 0, pageToMove); // insert at new position
          } else {
            // Moving up: target index stays the same
            newPages.splice(draggedPage.pageIndex, 1); // remove from old position
            newPages.splice(targetPageIndex, 0, pageToMove); // insert at new position
          }
          
          return { ...sec, pages: newPages };
        }
        return sec;
      }));
    } else {
      // MOVE to different section (existing behavior)
      setSections(s => s.map(sec => {
        if (sec.id === draggedPage.sectionId) {
          return { ...sec, pages: sec.pages.filter((p, i) => i !== draggedPage.pageIndex) };
        } else if (sec.id === targetSectionId) {
          const newPages = [...sec.pages];
          newPages.splice(targetPageIndex, 0, pageToMove);
          return { ...sec, pages: newPages };
        }
        return sec;
      }));
    }
    
    setDraggedPage(null);
  };
  
  const handleDrop = (e, targetSectionId) => {
    e.preventDefault();
    if (!draggedPage || draggedPage.sectionId === targetSectionId) {
      setDraggedPage(null);
      return;
    }
    
    // Find the page being moved
    const sourceSection = sections.find(s => s.id === draggedPage.sectionId);
    const pageToMove = sourceSection?.pages.find(p => p.id === draggedPage.pageId);
    
    if (!pageToMove) {
      setDraggedPage(null);
      return;
    }
    
    // Remove from source and add to target
    setSections(s => s.map(sec => {
      if (sec.id === draggedPage.sectionId) {
        // Remove from source
        return { ...sec, pages: sec.pages.filter(p => p.id !== draggedPage.pageId) };
      } else if (sec.id === targetSectionId) {
        // Add to target
        return { ...sec, pages: [...sec.pages, pageToMove] };
      }
      return sec;
    }));
    
    setDraggedPage(null);
  };

  const handleSectionDragStart = (e, sectionId) => {
    setDraggedSection(sectionId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleSectionDragOver = (e, folderId) => {
    // Only handle section drags, ignore page drags
    if (draggedPage) return;
    
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleSectionDrop = (e, folderId) => {
    // Only handle section drags, ignore page drags
    if (draggedPage) return;
    
    e.preventDefault();
    e.stopPropagation();
    if (!draggedSection || draggedSection === folderId) {
      setDraggedSection(null);
      return;
    }
    
    // Move section into folder or out of folder
    setSections(s => s.map(sec => {
      if (sec.id === draggedSection) {
        return { ...sec, parentId: folderId || null };
      }
      return sec;
    }));
    
    setDraggedSection(null);
  };

  // Sticky image helpers
  const addStickyImage = (sectionId, pageId, imageUrl, position) => {
    setSections(s => {
      const updatedSections = s.map(sec =>
        sec.id === sectionId
          ? { 
              ...sec, 
              pages: sec.pages.map(p => 
                p.id === pageId 
                  ? { 
                      ...p, 
                      stickyImages: [
                        ...(p.stickyImages || []), 
                        {
                          id: Date.now().toString(),
                          imageUrl,
                          selectedText: position.selectedText,
                          textStart: position.textStart,
                          textEnd: position.textEnd,
                          createdAt: new Date().toISOString()
                        }
                      ]
                    }
                  : p
              )
            }
          : sec
      );
      
      if (currentUser?.uid) {
        saveNotebook(currentUser.uid, updatedSections);
      }
      
      return updatedSections;
    });
  };

  const deleteStickyImage = (sectionId, pageId, imageId) => {
    setSections(s => {
      const updatedSections = s.map(sec =>
        sec.id === sectionId
          ? { 
              ...sec, 
              pages: sec.pages.map(p => 
                p.id === pageId 
                  ? { 
                      ...p, 
                      stickyImages: (p.stickyImages || []).filter(img => img.id !== imageId)
                    }
                  : p
              )
            }
          : sec
      );
      
      if (currentUser?.uid) {
        saveNotebook(currentUser.uid, updatedSections);
      }
      
      return updatedSections;
    });
  };

  // Mouse-based text selection handling
  const [mousePosition, setMousePosition] = useState(null);
  
  const handleMouseUp = (e) => {
    const selection = window.getSelection();

    if (selection.rangeCount > 0 && selection.toString().trim()) {
      // Use mouse coordinates relative to the textarea to position the button.
      const textareaRect = editorRef.current.getBoundingClientRect();
      const buttonX = e.clientX - textareaRect.left;
      const buttonY = e.clientY - textareaRect.top;

      // Get text position for upload
      const textStart = editorRef.current.selectionStart;
      const textEnd = editorRef.current.selectionEnd;

      setSelectionPosition({
        x: buttonX,
        y: buttonY,
        selectedText: selection.toString().trim(),
        textStart,
        textEnd
      });

      setMousePosition({ x: buttonX, y: buttonY });
    } else {
      setSelectionPosition(null);
      setMousePosition(null);
    }
  };

  // Track which text ranges have images
  const [highlightedImageId, setHighlightedImageId] = useState(null);
  
  // Check if cursor is over text with sticky image (only on click, not hover)
  const handleTextClick = (e) => {
    if (!page?.stickyImages || !editorRef.current) {
      // Clear highlight if no page or images
      setHighlightedImageId(null);
      return;
    }
    
    const cursorPosition = editorRef.current.selectionStart;
    
    const clickedImage = page.stickyImages.find(img => {
      // Make sure we have valid text positions
      if (typeof img.textStart !== 'number' || typeof img.textEnd !== 'number') return false;
      return cursorPosition >= img.textStart && cursorPosition <= img.textEnd;
    });
    
    // Always update highlighted image state - either set to found image or clear it
    setHighlightedImageId(clickedImage ? clickedImage.id : null);
  };

  // Image upload handling
  const handleImageUpload = async (file) => {
    if (!file || !currentUser?.uid || !selectedSection || !selectedPage) {
      console.log('Upload blocked:', { file: !!file, user: !!currentUser?.uid, section: selectedSection, page: selectedPage });
      return;
    }
    
    console.log('Starting image upload...', { file: file.name, size: file.size });
    setUploadingImage(true);
    
    try {
      const imageRef = ref(storage, `sticky-images/${currentUser.uid}/${Date.now()}-${file.name}`);
      console.log('Uploading to:', imageRef.fullPath);
      
      await uploadBytes(imageRef, file);
      const imageUrl = await getDownloadURL(imageRef);
      console.log('Image uploaded successfully:', imageUrl);
      
      if (selectionPosition) {
        console.log('Adding sticky image with position:', selectionPosition);
        addStickyImage(selectedSection, selectedPage, imageUrl, {
          selectedText: selectionPosition.selectedText,
          textStart: selectionPosition.textStart,
          textEnd: selectionPosition.textEnd
        });
        setSelectionPosition(null);
        console.log('Sticky image added to page');
      } else {
        console.log('No selection position found');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
    } finally {
      setUploadingImage(false);
    }
  };

  const triggerImageUpload = () => {
    fileInputRef.current?.click();
  };

  // Editor bullet support
  const handleEditorInput = (e) => {
    let value = e.target.value;
    // Bullet support: auto-insert bullet on new line if previous line starts with - or *
    const lines = value.split("\n");
    for (let i = 1; i < lines.length; i++) {
      if ((lines[i - 1].trim().startsWith("-") || lines[i - 1].trim().startsWith("*")) && lines[i] === "") {
        lines[i] = "- ";
      }
    }
    value = lines.join("\n");
    if (value !== e.target.value) {
      e.target.value = value;
    }
    setPageContent(selectedSection, selectedPage, value);
  };

  // Get current section/page
  const section = sections.find(s => s.id === selectedSection);
  const page = section?.pages.find(p => p.id === selectedPage);

  // Search filter
  const filteredSections = sections.map(sec => {
    if (!searchQuery.trim()) return sec;
    
    const sectionNameMatch = sec.name.toLowerCase().includes(searchQuery.toLowerCase());
    const filteredPages = sec.pages.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.content.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    if (sectionNameMatch || filteredPages.length > 0) {
      return { ...sec, pages: sectionNameMatch ? sec.pages : filteredPages, collapsed: false };
    }
    return null;
  }).filter(Boolean);

  // Hierarchy organization
  const topLevelItems = filteredSections.filter(s => !s.parentId);
  const getSectionsByParent = (parentId) => 
    filteredSections.filter(s => s.parentId === parentId);

  // Clear highlighted image when switching pages
  useEffect(() => {
    setHighlightedImageId(null);
  }, [selectedPage, selectedSection]);

  // Clear highlight when clicking outside textarea
  const clearHighlight = () => {
    setHighlightedImageId(null);
  };

  return (
    <div className="flex w-full min-h-screen bg-[#101014] text-[#e5e5e5]" onClick={clearHighlight}>
      {/* Sidebar */}
      <aside className={`${sidebarExpanded ? 'w-[900px]' : 'w-80'} min-w-[16rem] bg-[#18181c] border-r border-white/5 flex flex-col p-4 gap-4 transition-all duration-300 ease-in-out`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-2">
          <BookOpenIcon className="w-7 h-7 text-blue-400" />
          <span className="text-2xl font-bold tracking-tight">Notebook</span>
          <button
            onClick={() => {
              setSidebarExpanded(!sidebarExpanded);
              if (currentUser?.uid) {
                localStorage.setItem(getSidebarExpandedKey(currentUser.uid), String(!sidebarExpanded));
              }
            }}
            className="ml-auto p-2 hover:bg-white/10 rounded transition-colors"
            title={sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            {sidebarExpanded ? (
              <ChevronDoubleLeftIcon className="w-5 h-5" />
            ) : (
              <ChevronDoubleRightIcon className="w-5 h-5" />
            )}
          </button>
        </div>
        
        {/* Search Bar */}
        <div className="relative">
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-8 py-2 bg-[#101014] border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
        </div>
        
        <div className="relative">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="flex items-center gap-2 px-3 py-2 bg-blue-700 hover:bg-blue-600 rounded text-white font-semibold transition-colors duration-200 w-full"
          >
            <PlusIcon className="w-5 h-5" /> Add New
          </button>
          {showAddMenu && (
            <div className="absolute top-full mt-1 w-full bg-[#101014] border border-white/20 rounded-lg shadow-xl z-50">
              <button
                onClick={() => { addSection(); setShowAddMenu(false); }}
                className="w-full px-3 py-2 hover:bg-white/10 text-left rounded-t-lg"
              >
                New Section
              </button>
              <button
                onClick={() => { addFolder(); setShowAddMenu(false); }}
                className="w-full px-3 py-2 hover:bg-white/10 text-left rounded-b-lg"
              >
                New Folder
              </button>
            </div>
          )}
        </div>
        
        <div className={`flex-1 overflow-y-auto pr-1 ${sidebarExpanded ? 'grid grid-cols-3 gap-2' : 'flex flex-col'}`}>
          {/* Recent Pages */}
          {recentPages.length > 0 && !searchQuery && (
            <div className="mb-4 rounded-lg bg-[#101014] border border-white/5">
              <div 
                className="flex items-center gap-2 px-2 py-2 cursor-pointer hover:bg-white/5 rounded-t-lg"
                onClick={() => setRecentCollapsed(!recentCollapsed)}
              >
                {recentCollapsed ? (
                  <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                )}
                <ClockIcon className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-semibold text-gray-300">Recent</span>
              </div>
              {!recentCollapsed && (
                <div className="px-2 pb-2">
                  {recentPages.map((recent, idx) => (
                    <div
                      key={idx}
                      className="flex items-center px-2 py-1 text-sm cursor-pointer hover:bg-white/5 rounded"
                      onClick={() => {
                        setSelectedSection(recent.sectionId);
                        setSelectedPage(recent.pageId);
                      }}
                    >
                      <span className="text-gray-400 truncate">
                        {recent.sectionName} › {recent.pageName}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Root Drop Zone for moving sections out of folders */}
          {draggedSection && !draggedPage && (
            <div
              className="mb-2 p-4 border-2 border-dashed border-blue-400 rounded-lg bg-blue-400/10 text-center text-blue-300"
              onDragOver={(e) => handleSectionDragOver(e, null)}
              onDrop={(e) => handleSectionDrop(e, null)}
            >
              Drop here to move section to root level
            </div>
          )}
          
          {/* Sections */}
          {topLevelItems.map(item => (
            <React.Fragment key={item.id}>
              {item.isFolder ? (
                /* FOLDER RENDERING */
                <div 
                  className={`mb-2 rounded-lg border-l-4 ${selectedSection === item.id ? 'bg-opacity-20' : ''} ${draggedSection ? 'border-2 border-dashed border-blue-400' : ''}`}
                  style={{ 
                    borderLeftColor: item.color || '#3b82f6',
                    backgroundColor: selectedSection === item.id ? `${item.color}20` : 'transparent'
                  }}
                  onDragOver={(e) => handleSectionDragOver(e, item.id)}
                  onDrop={(e) => handleSectionDrop(e, item.id)}
                >
                  <div className="flex items-center group px-2 py-1">
                    {/* Collapse/Expand Chevron */}
                    <button
                      onClick={() => toggleSectionCollapse(item.id)}
                      className="p-1 hover:bg-white/10 rounded mr-1"
                      title={item.collapsed ? "Expand" : "Collapse"}
                    >
                      {item.collapsed ? (
                        <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                    
                    {/* Folder Icon */}
                    <FolderIcon className="w-5 h-5 mr-2" style={{ color: item.color }} />
                    
                    {editingSection === item.id ? (
                      <input
                        className="bg-transparent border-b text-lg font-semibold w-full outline-none"
                        style={{ borderBottomColor: item.color }}
                        value={item.name}
                        autoFocus
                        onChange={e => renameSection(item.id, e.target.value)}
                        onBlur={() => setEditingSection(null)}
                        onKeyDown={e => { if (e.key === 'Enter') setEditingSection(null); }}
                      />
                    ) : (
                      <span
                        className="flex-1 text-lg font-semibold cursor-pointer hover:opacity-80 transition-opacity duration-200"
                        style={{ color: item.color }}
                        onClick={() => setSelectedSection(item.id)}
                        onDoubleClick={() => setEditingSection(item.id)}
                      >
                        {item.name}
                      </span>
                    )}
                    
                    {/* Action Buttons */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button
                        className="p-1 hover:text-blue-400"
                        onClick={e => { e.stopPropagation(); setColorPickerOpen(colorPickerOpen === item.id ? null : item.id); }}
                        title="Change Color"
                      >
                        <SwatchIcon className="w-4 h-4" />
                      </button>
                      <button className="p-1 hover:text-blue-400" onClick={e => { e.stopPropagation(); setEditingSection(item.id); }} title="Rename Folder"><PencilIcon className="w-4 h-4" /></button>
                      <button className="p-1 hover:text-red-400" onClick={e => { e.stopPropagation(); deleteSection(item.id); }} title="Delete Folder"><TrashIcon className="w-4 h-4" /></button>
                    </div>
                  </div>
                  
                  {/* Color Picker */}
                  {colorPickerOpen === item.id && (
                    <div className="px-2 py-2 bg-[#101014] border-t border-white/10">
                      <div className="flex gap-2">
                        {SECTION_COLORS.map(color => (
                          <button
                            key={color.value}
                            className="w-6 h-6 rounded border-2 hover:scale-110 transition-transform"
                            style={{ backgroundColor: color.value, borderColor: item.color === color.value ? 'white' : 'transparent' }}
                            onClick={() => changeSectionColor(item.id, color.value)}
                            title={color.name}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Folder Contents */}
                  {!item.collapsed && (
                    <div className="pl-6">
                      {getSectionsByParent(item.id).map(childSection => (
                        <div 
                          key={childSection.id} 
                          className={`mb-2 rounded-lg border-l-4 ${selectedSection === childSection.id ? 'bg-opacity-20' : ''} ${draggedSection === childSection.id ? 'opacity-50' : ''}`}
                          style={{ 
                            borderLeftColor: childSection.color || '#3b82f6',
                            backgroundColor: selectedSection === childSection.id ? `${childSection.color}20` : 'transparent'
                          }}
                          draggable
                          onDragStart={(e) => handleSectionDragStart(e, childSection.id)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, childSection.id)}
                        >
                          <div className="flex items-center group px-2 py-1">
                            {/* Collapse/Expand Chevron */}
                            <button
                              onClick={() => toggleSectionCollapse(childSection.id)}
                              className="p-1 hover:bg-white/10 rounded mr-1"
                              title={childSection.collapsed ? "Expand" : "Collapse"}
                            >
                              {childSection.collapsed ? (
                                <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                              )}
                            </button>
                            
                            {editingSection === childSection.id ? (
                              <input
                                className="bg-transparent border-b text-lg font-semibold w-full outline-none"
                                style={{ borderBottomColor: childSection.color }}
                                value={childSection.name}
                                autoFocus
                                onChange={e => renameSection(childSection.id, e.target.value)}
                                onBlur={() => setEditingSection(null)}
                                onKeyDown={e => { if (e.key === 'Enter') setEditingSection(null); }}
                              />
                            ) : (
                              <span
                                className="flex-1 text-lg font-semibold cursor-pointer hover:opacity-80 transition-opacity duration-200"
                                style={{ color: childSection.color }}
                                onClick={() => { 
                                  setSelectedSection(childSection.id); 
                                  if (childSection.pages.length > 0 && !childSection.collapsed) setSelectedPage(childSection.pages[0].id); 
                                }}
                                onDoubleClick={() => setEditingSection(childSection.id)}
                              >
                                {childSection.name}
                              </span>
                            )}
                            
                            {/* Action Buttons */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                              <button
                                className="p-1 hover:text-blue-400"
                                onClick={e => { e.stopPropagation(); setColorPickerOpen(colorPickerOpen === childSection.id ? null : childSection.id); }}
                                title="Change Color"
                              >
                                <SwatchIcon className="w-4 h-4" />
                              </button>
                              <button className="p-1 hover:text-blue-400" onClick={e => { e.stopPropagation(); setEditingSection(childSection.id); }} title="Rename Section"><PencilIcon className="w-4 h-4" /></button>
                              <button className="p-1 hover:text-red-400" onClick={e => { e.stopPropagation(); deleteSection(childSection.id); }} title="Delete Section"><TrashIcon className="w-4 h-4" /></button>
                              <button 
                                className="p-1 hover:text-orange-400" 
                                onClick={e => { e.stopPropagation(); setSections(s => s.map(sec => sec.id === childSection.id ? { ...sec, parentId: null } : sec)); }} 
                                title="Remove from folder"
                              >
                                <XMarkIcon className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          
                          {/* Color Picker */}
                          {colorPickerOpen === childSection.id && (
                            <div className="px-2 py-2 bg-[#101014] border-t border-white/10">
                              <div className="flex gap-2">
                                {SECTION_COLORS.map(color => (
                                  <button
                                    key={color.value}
                                    className="w-6 h-6 rounded border-2 hover:scale-110 transition-transform"
                                    style={{ backgroundColor: color.value, borderColor: childSection.color === color.value ? 'white' : 'transparent' }}
                                    onClick={() => changeSectionColor(childSection.id, color.value)}
                                    title={color.name}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Pages */}
                          {!childSection.collapsed && (
                            <div className="pl-4">
                              {childSection.pages.map((p, pageIndex) => (
                                <React.Fragment key={p.id}>
                                  {/* Drop indicator BEFORE page */}
                                  <div
                                    className={`h-1 transition-all ${
                                      dragOverPageIndex?.sectionId === childSection.id && dragOverPageIndex?.pageIndex === pageIndex
                                        ? 'bg-blue-500 h-1 my-0.5 rounded'
                                        : 'h-0'
                                    }`}
                                    onDragOver={(e) => handlePageDragOver(e, childSection.id, pageIndex)}
                                    onDrop={(e) => handlePageDrop(e, childSection.id, pageIndex)}
                                  />
                                  
                                  <div 
                                    className={`flex items-center group px-2 py-1 rounded cursor-move ${
                                      selectedPage === p.id 
                                        ? 'bg-opacity-40' 
                                        : 'hover:bg-white/5'
                                    } ${draggedPage?.pageId === p.id ? 'opacity-50' : ''}`}
                                    style={{ 
                                      backgroundColor: selectedPage === p.id ? `${childSection.color}40` : 'transparent'
                                    }}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, childSection.id, p.id, pageIndex)}
                                    onClick={() => { setSelectedSection(childSection.id); setSelectedPage(p.id); }}
                                  >
                                    {editingPage === p.id ? (
                                      <input
                                        className="bg-transparent border-b text-base w-full outline-none"
                                        style={{ borderBottomColor: childSection.color }}
                                        value={p.name}
                                        autoFocus
                                        onChange={e => renamePage(childSection.id, p.id, e.target.value)}
                                        onBlur={() => setEditingPage(null)}
                                        onKeyDown={e => { if (e.key === 'Enter') setEditingPage(null); }}
                                      />
                                    ) : (
                                      <span 
                                        className="flex-1 text-base cursor-move hover:opacity-80 transition-opacity duration-200" 
                                        onDoubleClick={() => setEditingPage(p.id)}
                                      >
                                        {p.name}
                                      </span>
                                    )}
                                    <button className="ml-1 p-1 hover:text-blue-400" onClick={e => { e.stopPropagation(); setEditingPage(p.id); }} title="Rename Page"><PencilIcon className="w-4 h-4" /></button>
                                    <button className="ml-1 p-1 hover:text-red-400" onClick={e => { e.stopPropagation(); deletePage(childSection.id, p.id); }} title="Delete Page"><TrashIcon className="w-4 h-4" /></button>
                                  </div>
                                  
                                  {/* Drop indicator AFTER last page */}
                                  {pageIndex === childSection.pages.length - 1 && (
                                    <div
                                      className={`h-1 transition-all ${
                                        dragOverPageIndex?.sectionId === childSection.id && dragOverPageIndex?.pageIndex === pageIndex + 1
                                          ? 'bg-blue-500 h-1 my-0.5 rounded'
                                          : 'h-0'
                                      }`}
                                      onDragOver={(e) => handlePageDragOver(e, childSection.id, pageIndex + 1)}
                                      onDrop={(e) => handlePageDrop(e, childSection.id, pageIndex + 1)}
                                    />
                                  )}
                                </React.Fragment>
                              ))}
                              <button
                                className="flex items-center gap-1 text-xs text-blue-300 hover:text-blue-100 transition-colors duration-200 mt-1 mb-2"
                                onClick={() => addPage(childSection.id)}
                              >
                                <PlusIcon className="w-4 h-4" /> New Page
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* REGULAR SECTION RENDERING */
                <div 
                  className={`mb-2 rounded-lg border-l-4 ${selectedSection === item.id ? 'bg-opacity-20' : ''} ${draggedSection === item.id ? 'opacity-50' : ''}`}
                  style={{ 
                    borderLeftColor: item.color || '#3b82f6',
                    backgroundColor: selectedSection === item.id ? `${item.color}20` : 'transparent'
                  }}
                  draggable
                  onDragStart={(e) => handleSectionDragStart(e, item.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, item.id)}
                > 
              <div className="flex items-center group px-2 py-1">
                {/* Collapse/Expand Chevron */}
                <button
                  onClick={() => toggleSectionCollapse(item.id)}
                  className="p-1 hover:bg-white/10 rounded mr-1"
                  title={item.collapsed ? "Expand" : "Collapse"}
                >
                  {item.collapsed ? (
                    <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                  )}
                </button>
                
                {editingSection === item.id ? (
                  <input
                    className="bg-transparent border-b text-lg font-semibold w-full outline-none"
                    style={{ borderBottomColor: item.color }}
                    value={item.name}
                    autoFocus
                    onChange={e => renameSection(item.id, e.target.value)}
                    onBlur={() => setEditingSection(null)}
                    onKeyDown={e => { if (e.key === 'Enter') setEditingSection(null); }}
                  />
                ) : (
                  <span
                    className="flex-1 text-lg font-semibold cursor-pointer hover:opacity-80 transition-opacity duration-200"
                    style={{ color: item.color }}
                    onClick={() => { 
                      setSelectedSection(item.id); 
                      if (item.pages.length > 0 && !item.collapsed) setSelectedPage(item.pages[0].id); 
                    }}
                    onDoubleClick={() => setEditingSection(item.id)}
                  >
                    {item.name}
                  </span>
                )}
                
                {/* Color Picker */}
                <div className="relative">
                  <button 
                    className="ml-1 p-1 hover:text-blue-400 relative" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setColorPickerOpen(colorPickerOpen === item.id ? null : item.id);
                    }} 
                    title="Change Color"
                  >
                    <SwatchIcon className="w-4 h-4" style={{ color: item.color }} />
                  </button>
                  
                  {/* Color Picker Dropdown */}
                  {colorPickerOpen === item.id && (
                    <div 
                      className="absolute right-0 top-8 z-50 bg-[#101014] border border-white/20 rounded-lg p-2 shadow-xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="grid grid-cols-4 gap-2">
                        {SECTION_COLORS.map(color => (
                          <button
                            key={color.value}
                            className="w-6 h-6 rounded hover:scale-110 transition-transform border-2 border-white/20"
                            style={{ backgroundColor: color.value }}
                            onClick={() => changeSectionColor(item.id, color.value)}
                            title={color.name}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <button className="ml-1 p-1 hover:text-blue-400" onClick={() => setEditingSection(item.id)} title="Rename Section"><PencilIcon className="w-4 h-4" /></button>
                <button className="ml-1 p-1 hover:text-red-400" onClick={() => deleteSection(item.id)} title="Delete Section"><TrashIcon className="w-4 h-4" /></button>
              </div>
              
              {/* Pages */}
              {!item.collapsed && (
              <div className="pl-4">
                {item.pages.map((p, pageIndex) => (
                  <React.Fragment key={p.id}>
                    {/* Drop indicator BEFORE page */}
                    <div
                      className={`h-1 transition-all ${
                        dragOverPageIndex?.sectionId === item.id && dragOverPageIndex?.pageIndex === pageIndex
                          ? 'bg-blue-500 h-1 my-0.5 rounded'
                          : 'h-0'
                      }`}
                      onDragOver={(e) => handlePageDragOver(e, item.id, pageIndex)}
                      onDrop={(e) => handlePageDrop(e, item.id, pageIndex)}
                    />
                    
                    <div 
                      className={`flex items-center group px-2 py-1 rounded cursor-move ${
                        selectedPage === p.id 
                          ? 'bg-opacity-40' 
                          : 'hover:bg-white/5'
                      } ${draggedPage?.pageId === p.id ? 'opacity-50' : ''}`}
                      style={{ 
                        backgroundColor: selectedPage === p.id ? `${item.color}40` : 'transparent'
                      }}
                      draggable
                      onDragStart={(e) => handleDragStart(e, item.id, p.id, pageIndex)}
                      onClick={() => { setSelectedSection(item.id); setSelectedPage(p.id); }}
                    >
                    {editingPage === p.id ? (
                      <input
                        className="bg-transparent border-b text-base w-full outline-none"
                        style={{ borderBottomColor: item.color }}
                        value={p.name}
                        autoFocus
                        onChange={e => renamePage(item.id, p.id, e.target.value)}
                        onBlur={() => setEditingPage(null)}
                        onKeyDown={e => { if (e.key === 'Enter') setEditingPage(null); }}
                      />
                    ) : (
                      <span 
                        className="flex-1 text-base cursor-move hover:opacity-80 transition-opacity duration-200" 
                        onDoubleClick={() => setEditingPage(p.id)}
                      >
                        {p.name}
                      </span>
                    )}
                    <button className="ml-1 p-1 hover:text-blue-400" onClick={e => { e.stopPropagation(); setEditingPage(p.id); }} title="Rename Page"><PencilIcon className="w-4 h-4" /></button>
                    <button className="ml-1 p-1 hover:text-red-400" onClick={e => { e.stopPropagation(); deletePage(item.id, p.id); }} title="Delete Page"><TrashIcon className="w-4 h-4" /></button>
                  </div>
                  
                  {/* Drop indicator AFTER last page */}
                  {pageIndex === item.pages.length - 1 && (
                    <div
                      className={`h-1 transition-all ${
                        dragOverPageIndex?.sectionId === item.id && dragOverPageIndex?.pageIndex === pageIndex + 1
                          ? 'bg-blue-500 h-1 my-0.5 rounded'
                          : 'h-0'
                      }`}
                      onDragOver={(e) => handlePageDragOver(e, item.id, pageIndex + 1)}
                      onDrop={(e) => handlePageDrop(e, item.id, pageIndex + 1)}
                    />
                  )}
                </React.Fragment>
                ))}
                <button
                  className="flex items-center gap-1 text-xs text-blue-300 hover:text-blue-100 transition-colors duration-200 mt-1 mb-2"
                  onClick={() => addPage(item.id)}
                >
                  <PlusIcon className="w-4 h-4" /> New Page
                </button>
              </div>
              )}
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </aside>
      {/* Editor */}
      <main className="flex-1 flex flex-col p-4">
        {section && page ? (
          <div className="flex-1 flex gap-6 max-w-none">
            {/* Text Editor */}
            <div className="flex-1 flex flex-col gap-3">
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <PencilIcon className="w-5 h-5 text-blue-400" />
                <input
                  className="bg-transparent border-b border-blue-400 text-xl font-bold w-full outline-none focus:border-blue-200 transition-colors duration-200"
                  value={page.name}
                  onChange={e => renamePage(section.id, page.id, e.target.value)}
                  onClick={clearHighlight}
                />
              </div>
              <div className="relative flex-1">
                <textarea
                  ref={editorRef}
                  className="w-full h-full min-h-[600px] bg-[#18181c] rounded-lg p-4 text-base font-mono text-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 resize-none"
                  value={page.content}
                  onChange={handleEditorInput}
                  onMouseUp={handleMouseUp}
                  onClick={(e) => { e.stopPropagation(); handleTextClick(e); }}
                  onKeyUp={handleTextClick}
                  onFocus={handleTextClick}
                  placeholder="Start typing your notes...\n- Bullet points supported with '-' or '*'"
                  spellCheck={false}
                />
                
                {/* Upload Button - Right next to selection */}
                {selectionPosition && (
                  <div 
                    className="absolute bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded shadow-lg z-[9999] flex items-center gap-2 transition-colors duration-200"
                    style={{ 
                      left: `${selectionPosition.x}px`, 
                      top: `${selectionPosition.y + 5}px` 
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={triggerImageUpload}
                      disabled={uploadingImage}
                      className="flex items-center gap-1 text-sm font-medium disabled:opacity-50"
                    >
                      <PhotoIcon className={`w-4 h-4 ${uploadingImage ? 'animate-spin' : ''}`} />
                      {uploadingImage ? 'Uploading...' : 'Add Image'}
                    </button>
                  </div>
                )}
                

              </div>
            </div>
            
            {/* Sticky Notes Grid */}
            <div className="w-56 bg-[#18181c] rounded-lg p-3 flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2 mb-2">
                <PhotoIcon className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-[#e5e5e5]">Sticky Notes</span>
                <span className="text-xs text-gray-400">
                  ({page.stickyImages?.length || 0})
                </span>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                {page.stickyImages && page.stickyImages.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {page.stickyImages.map((stickyImage, index) => {
                      const isHighlighted = highlightedImageId === stickyImage.id;
                      return (
                        <div
                          key={stickyImage.id}
                          className="transition-all duration-300"
                          data-sticky-id={stickyImage.id}
                        >
                          <button
                            onClick={() => {
                              setSelectedImage(stickyImage.imageUrl);
                              setShowImageModal(true);
                            }}
                            className={`group w-full aspect-square rounded-lg shadow-md hover:shadow-xl transition-all duration-500 relative overflow-hidden ${
                              isHighlighted 
                                ? 'scale-[1.5] shadow-2xl z-20' 
                                : 'hover:scale-105 hover:z-10'
                            }`}
                            title={`Image for: "${stickyImage.selectedText || 'Unknown text'}"`}
                          >
                            {/* Loading State */}
                            {loadingImages.has(stickyImage.id) && (
                              <div className="absolute inset-0 flex items-center justify-center bg-gray-800/80">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
                              </div>
                            )}
                            
                            {/* Actual Image */}
                            <img
                              src={stickyImage.imageUrl}
                              alt={`Sticky note for: ${stickyImage.selectedText}`}
                              className="w-full h-full object-cover transition-all duration-300 group-hover:brightness-105"
                              onLoadStart={() => {
                                setLoadingImages(prev => new Set(prev).add(stickyImage.id));
                              }}
                              onError={(e) => {
                                // Fallback to icon if image fails to load
                                setLoadingImages(prev => {
                                  const newSet = new Set(prev);
                                  newSet.delete(stickyImage.id);
                                  return newSet;
                                });
                                e.target.style.display = 'none';
                                e.target.parentElement.querySelector('.fallback-icon').style.display = 'flex';
                              }}
                              onLoad={(e) => {
                                // Hide fallback icon if image loads successfully
                                setLoadingImages(prev => {
                                  const newSet = new Set(prev);
                                  newSet.delete(stickyImage.id);
                                  return newSet;
                                });
                                e.target.parentElement.querySelector('.fallback-icon').style.display = 'none';
                              }}
                            />
                            
                            {/* Fallback Icon */}
                            <div className="fallback-icon absolute inset-0 flex items-center justify-center bg-yellow-400" style={{ display: 'none' }}>
                              <PhotoIcon className="w-6 h-6 text-yellow-800" />
                            </div>
                            
                            {/* Text Overlay */}
                            <div className="absolute bottom-0 left-0 right-0 text-white text-xs p-1 truncate backdrop-blur-sm bg-black/60 group-hover:bg-black/70 transition-all duration-300">
                              {stickyImage.selectedText ? stickyImage.selectedText.substring(0, 12) + '...' : 'Image'}
                            </div>

                            {/* Delete Button inside the image button to keep positioning consistent */}
                            <span
                              onClick={(e) => { e.stopPropagation(); deleteStickyImage(selectedSection, selectedPage, stickyImage.id); }}
                              className="absolute top-1 right-1 w-4 h-4 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-30"
                              title="Delete sticky image"
                            >
                              <XMarkIcon className="w-2 h-2 text-white" />
                            </span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    <PhotoIcon className="w-6 h-6 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">No notes yet</p>
                    <p className="text-xs opacity-75">Highlight text and add sticky notes</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-neutral-400 text-lg opacity-70 select-none">Select or create a section and page to start taking notes.</div>
          </div>
        )}
        
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              handleImageUpload(file);
              e.target.value = ''; // Reset input
            }
          }}
          className="hidden"
        />
        
        {/* Image Modal */}
        {showImageModal && selectedImage && (
          <div 
            className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 animate-fadeIn" 
            onClick={() => setShowImageModal(false)}
          >
            <div className="relative max-w-5xl max-h-5xl p-4 animate-scaleIn">
              <button
                onClick={() => setShowImageModal(false)}
                className="absolute top-2 right-2 w-12 h-12 bg-red-500 hover:bg-red-400 hover:scale-110 rounded-full flex items-center justify-center text-white z-10 transition-all duration-300 shadow-lg hover:shadow-red-500/30"
              >
                <XMarkIcon className="w-7 h-7" />
              </button>
              <img
                src={selectedImage}
                alt="Sticky note image"
                className="max-w-full max-h-full object-contain rounded-xl shadow-3xl hover:scale-105 transition-transform duration-300"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
} 