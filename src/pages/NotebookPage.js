import React, { useState, useEffect, useRef, useContext } from "react";
import { PlusIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/solid';
import { BookOpenIcon } from '@heroicons/react/24/outline';
import { UserContext } from '../App';

function getNotebookKey(user) { return `notebookData-${user || 'default'}`; }
function getSectionKey(user) { return `notebookSelectedSection-${user || 'default'}`; }
function getPageKey(user) { return `notebookSelectedPage-${user || 'default'}`; }

function loadNotebook(user) {
  const key = getNotebookKey(user);
  let data;
  try {
    data = JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    data = [];
  }
  console.log('[NOTEBOOK] loadNotebook:', { user, key, data, localStorage });
  return data;
}
function saveNotebook(user, data) {
  const key = getNotebookKey(user);
  localStorage.setItem(key, JSON.stringify(data));
  console.log('[NOTEBOOK] saveNotebook:', { user, key, data, localStorage });
}

export default function NotebookPage() {
  const { user } = useContext(UserContext);
  console.log('[NOTEBOOK] NotebookPage user:', user);
  // Initialize sections from localStorage for the current user
  const [sections, setSections] = useState(() => loadNotebook(user));
  const [selectedSection, setSelectedSection] = useState(() => localStorage.getItem(getSectionKey(user)));
  const [selectedPage, setSelectedPage] = useState(() => localStorage.getItem(getPageKey(user)));
  const [editingSection, setEditingSection] = useState(null);
  const [editingPage, setEditingPage] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const editorRef = useRef();

  // Save to localStorage
  useEffect(() => {
    if (user) {
      saveNotebook(user, sections);
    }
  }, [sections, user]);

  // Save selected section/page to localStorage
  useEffect(() => {
    if (user && selectedSection) {
      localStorage.setItem(getSectionKey(user), selectedSection);
      console.log('[NOTEBOOK] saveSelectedSection', { user, selectedSection, localStorage });
    }
    if (user && selectedPage) {
      localStorage.setItem(getPageKey(user), selectedPage);
      console.log('[NOTEBOOK] saveSelectedPage', { user, selectedPage, localStorage });
    }
  }, [selectedSection, selectedPage, user]);

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
    setSections(s => s.map(sec =>
      sec.id === sectionId
        ? { ...sec, pages: sec.pages.map(p => p.id === pageId ? { ...p, content } : p) }
        : sec
    ));
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

  return (
    <div className="flex w-full min-h-screen bg-[#101014] text-[#e5e5e5]">
      {/* Sidebar */}
      <aside className="w-80 min-w-[16rem] max-w-xs bg-[#18181c] border-r border-white/5 flex flex-col p-4 gap-4">
        <div className="flex items-center gap-2 mb-2">
          <BookOpenIcon className="w-7 h-7 text-blue-400" />
          <span className="text-2xl font-bold tracking-tight">Notebook</span>
        </div>
        <button
          className="flex items-center gap-2 px-3 py-2 bg-blue-700 hover:bg-blue-600 rounded text-white font-semibold mb-2"
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
                    className="flex-1 text-lg font-semibold cursor-pointer"
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
                      <span className="flex-1 text-base" onDoubleClick={() => setEditingPage(p.id)}>{p.name}</span>
                    )}
                    <button className="ml-1 p-1 hover:text-blue-400" onClick={e => { e.stopPropagation(); setEditingPage(p.id); }} title="Rename Page"><PencilIcon className="w-4 h-4" /></button>
                    <button className="ml-1 p-1 hover:text-red-400" onClick={e => { e.stopPropagation(); deletePage(sec.id, p.id); }} title="Delete Page"><TrashIcon className="w-4 h-4" /></button>
                  </div>
                ))}
                <button
                  className="flex items-center gap-1 text-xs text-blue-300 hover:text-blue-400 mt-1 mb-2"
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
          <div className="w-full max-w-3xl flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-2">
              <PencilIcon className="w-6 h-6 text-blue-400" />
              <input
                className="bg-transparent border-b border-blue-400 text-2xl font-bold w-full outline-none"
                value={page.name}
                onChange={e => renamePage(section.id, page.id, e.target.value)}
              />
            </div>
            <textarea
              ref={editorRef}
              className="w-full min-h-[400px] bg-[#18181c] rounded-xl p-6 text-lg font-mono text-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-150 shadow-xl resize-vertical"
              value={page.content}
              onChange={handleEditorInput}
              placeholder="Start typing your notes...\n- Bullet points supported with '-' or '*'"
              spellCheck={false}
            />
          </div>
        ) : (
          <div className="text-neutral-400 text-lg opacity-70 select-none">Select or create a section and page to start taking notes.</div>
        )}
      </main>
    </div>
  );
} 