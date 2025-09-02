import React, { useState, useEffect, useRef, useContext } from "react";
import { PlusIcon, TrashIcon, PencilIcon, PhotoIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { BookOpenIcon } from '@heroicons/react/24/outline';
import { UserContext } from '../App';
import { storage, db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Notebook data is stored at the user level (not account level) so it's shared across all accounts
function getNotebookKey(user) { return `notebookData-${user || 'default'}`; }
function getSectionKey(user) { return `notebookSelectedSection-${user || 'default'}`; }
function getPageKey(user) { return `notebookSelectedPage-${user || 'default'}`; }

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
      const loadedSections = loadNotebook(currentUser.uid);
      const loadedSelectedSection = localStorage.getItem(getSectionKey(currentUser.uid));
      const loadedSelectedPage = localStorage.getItem(getPageKey(currentUser.uid));
      const localUpdatedAt = Number(localStorage.getItem(`${getNotebookKey(currentUser.uid)}-updatedAt`) || '0');

      setSections(loadedSections);
      setSelectedSection(loadedSelectedSection);
      setSelectedPage(loadedSelectedPage);

      console.log('[NOTEBOOK] Loaded local data for user:', currentUser.uid, {
        sections: loadedSections,
        selectedSection: loadedSelectedSection,
        selectedPage: loadedSelectedPage,
        localUpdatedAt
      });

      // Also load from Firestore and reconcile newest
      (async () => {
        try {
          const userDocRef = doc(db, 'notebooks', currentUser.uid);
          const snapshot = await getDoc(userDocRef);
          if (snapshot.exists()) {
            const remote = snapshot.data();
            const remoteSections = Array.isArray(remote?.sections) ? remote.sections : [];
            const remoteUpdatedAt = Number(remote?.updatedAt || 0);

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

  // Section helpers
  const addSection = () => {
    const id = Date.now().toString();
    const newSection = { id, name: "Untitled Section", pages: [] };
    setSections(s => [...s, newSection]);
    setSelectedSection(id);
    setSelectedPage(null);
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
      <aside className="w-80 min-w-[16rem] max-w-xs bg-[#18181c] border-r border-white/5 flex flex-col p-4 gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-2">
          <BookOpenIcon className="w-7 h-7 text-blue-400" />
          <span className="text-2xl font-bold tracking-tight">Notebook</span>
        </div>
        <button
          className="flex items-center gap-2 px-3 py-2 bg-blue-700 hover:bg-blue-600 rounded text-white font-semibold mb-2 transition-colors duration-200"
          onClick={addSection}
        >
          <PlusIcon className="w-5 h-5" /> New Section
        </button>
        <div className="flex-1 overflow-y-auto pr-1">
          {sections.map(sec => (
            <div key={sec.id} className={`mb-2 rounded-lg ${selectedSection === sec.id ? 'bg-blue-900/40' : ''}`}> 
              <div className="flex items-center group px-2 py-1">
                {editingSection === sec.id ? (
                  <input
                    className="bg-transparent border-b border-blue-400 text-lg font-semibold w-full outline-none"
                    value={sec.name}
                    autoFocus
                    onChange={e => renameSection(sec.id, e.target.value)}
                    onBlur={() => setEditingSection(null)}
                    onKeyDown={e => { if (e.key === 'Enter') setEditingSection(null); }}
                  />
                ) : (
                  <span
                    className="flex-1 text-lg font-semibold cursor-pointer hover:text-blue-300 transition-colors duration-200"
                    onClick={() => { setSelectedSection(sec.id); if (sec.pages.length > 0) setSelectedPage(sec.pages[0].id); }}
                    onDoubleClick={() => setEditingSection(sec.id)}
                  >
                    {sec.name}
                  </span>
                )}
                <button className="ml-1 p-1 hover:text-blue-400" onClick={() => setEditingSection(sec.id)} title="Rename Section"><PencilIcon className="w-4 h-4" /></button>
                <button className="ml-1 p-1 hover:text-red-400" onClick={() => deleteSection(sec.id)} title="Delete Section"><TrashIcon className="w-4 h-4" /></button>
              </div>
              {/* Pages */}
              <div className="pl-4">
                {sec.pages.map(p => (
                  <div key={p.id} className={`flex items-center group px-2 py-1 rounded cursor-pointer ${selectedPage === p.id ? 'bg-blue-800/40' : 'hover:bg-white/5'}`}
                    onClick={() => { setSelectedSection(sec.id); setSelectedPage(p.id); }}>
                    {editingPage === p.id ? (
                      <input
                        className="bg-transparent border-b border-blue-400 text-base w-full outline-none"
                        value={p.name}
                        autoFocus
                        onChange={e => renamePage(sec.id, p.id, e.target.value)}
                        onBlur={() => setEditingPage(null)}
                        onKeyDown={e => { if (e.key === 'Enter') setEditingPage(null); }}
                      />
                    ) : (
                      <span 
                        className="flex-1 text-base cursor-pointer hover:text-blue-200 transition-colors duration-200" 
                        onDoubleClick={() => setEditingPage(p.id)}
                      >
                        {p.name}
                      </span>
                    )}
                    <button className="ml-1 p-1 hover:text-blue-400" onClick={e => { e.stopPropagation(); setEditingPage(p.id); }} title="Rename Page"><PencilIcon className="w-4 h-4" /></button>
                    <button className="ml-1 p-1 hover:text-red-400" onClick={e => { e.stopPropagation(); deletePage(sec.id, p.id); }} title="Delete Page"><TrashIcon className="w-4 h-4" /></button>
                  </div>
                ))}
                <button
                  className="flex items-center gap-1 text-xs text-blue-300 hover:text-blue-100 transition-colors duration-200 mt-1 mb-2"
                  onClick={() => addPage(sec.id)}
                >
                  <PlusIcon className="w-4 h-4" /> New Page
                </button>
              </div>
            </div>
          ))}
        </div>
      </aside>
      {/* Editor */}
      <main className="flex-1 flex flex-col items-center justify-center p-8">
        {section && page ? (
          <div className="w-full max-w-7xl flex gap-8">
            {/* Text Editor */}
            <div className="flex-1 max-w-3xl flex flex-col gap-4">
              <div className="flex items-center gap-2 mb-2" onClick={(e) => e.stopPropagation()}>
                <PencilIcon className="w-6 h-6 text-blue-400" />
                <input
                  className="bg-transparent border-b border-blue-400 text-2xl font-bold w-full outline-none focus:border-blue-200 transition-colors duration-200"
                  value={page.name}
                  onChange={e => renamePage(section.id, page.id, e.target.value)}
                  onClick={clearHighlight}
                />
              </div>
              <div className="relative">
                            <textarea
              ref={editorRef}
              className="w-full min-h-[400px] bg-[#18181c] rounded-xl p-6 text-lg font-mono text-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 shadow-xl resize-vertical"
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
            <div className="w-64 bg-[#18181c] rounded-xl p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2 mb-3">
                <PhotoIcon className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-[#e5e5e5]">Sticky Notes</span>
                <span className="text-xs text-gray-400">
                  ({page.stickyImages?.length || 0})
                </span>
              </div>
              
              {page.stickyImages && page.stickyImages.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
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
                              ? 'scale-[2] shadow-2xl z-20' 
                              : 'hover:scale-110 hover:z-10'
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
                            {stickyImage.selectedText ? stickyImage.selectedText.substring(0, 15) + '...' : 'Image'}
                          </div>

                          {/* Delete Button inside the image button to keep positioning consistent */}
                          <span
                            onClick={(e) => { e.stopPropagation(); deleteStickyImage(selectedSection, selectedPage, stickyImage.id); }}
                            className="absolute top-1 right-1 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-30"
                            title="Delete sticky image"
                          >
                            <XMarkIcon className="w-3 h-3 text-white" />
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <PhotoIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No notes yet</p>
                  <p className="text-xs opacity-75">Highlight text and add sticky notes</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-neutral-400 text-lg opacity-70 select-none">Select or create a section and page to start taking notes.</div>
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