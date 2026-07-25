import { useRef, useState } from 'react';
import { ChevronDown, Download, Map, Plus, Redo2, Trash2, Undo2, Upload } from 'lucide-react';
import { selectActiveProject, usePlannerStore } from '../state/store';
import { downloadJson, isLayoutFile, pickFile, slugify } from '../lib/files';
import { Button, Panel, TextInput } from './ui';

export function ProjectBar() {
  const projects = usePlannerStore((s) => s.projects);
  const project = usePlannerStore(selectActiveProject);
  const canUndo = usePlannerStore((s) => s.past.length > 0);
  const canRedo = usePlannerStore((s) => s.future.length > 0);
  const undo = usePlannerStore((s) => s.undo);
  const redo = usePlannerStore((s) => s.redo);
  const store = usePlannerStore;
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  if (!project) return null;

  async function importKml() {
    const file = await pickFile('.kml,application/vnd.google-earth.kml+xml');
    if (!file || !project) return;
    store.getState().setProjectKml(project.id, {
      name: file.name,
      text: await file.text(),
      importedAt: Date.now(),
    });
  }

  function saveLayout() {
    const layout = store.getState().exportLayout();
    if (layout) downloadJson(`${slugify(layout.projectName)}-layout.json`, layout);
  }

  async function loadLayout() {
    const file = await pickFile('.json,application/json');
    if (!file) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      window.alert('That file is not valid JSON.');
      return;
    }
    if (!isLayoutFile(parsed)) {
      window.alert('That file is not a Farm Planner layout export.');
      return;
    }
    const merge = window.confirm(
      `“${file.name}” contains ${parsed.features.length} feature(s).\n\n` +
        'OK — add them to this project.\nCancel — replace everything in this project.',
    );
    store.getState().importLayout(parsed, merge ? 'merge' : 'replace');
  }

  function newProject() {
    const name = window.prompt('Name the new project', `Plan ${projects.length + 1}`);
    if (name) store.getState().createProject(name.trim() || 'Untitled plan');
    setOpen(false);
  }

  function deleteProject() {
    if (!project || projects.length < 2) return;
    if (window.confirm(`Delete “${project.name}” and its ${project.features.length} feature(s)?`)) {
      store.getState().deleteProject(project.id);
    }
    setOpen(false);
  }

  return (
    <Panel className="flex items-center gap-1 p-1.5">
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition hover:bg-white/10"
        >
          <span className="grid h-7 w-7 place-items-center rounded-md bg-sky-500/15 text-sky-300">
            <Map size={15} />
          </span>
          <span className="min-w-0">
            {renaming ? (
              <TextInput
                ref={nameRef}
                autoFocus
                defaultValue={project.name}
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => {
                  store.getState().renameProject(project.id, e.target.value.trim() || project.name);
                  setRenaming(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  if (e.key === 'Escape') setRenaming(false);
                }}
                className="w-44"
              />
            ) : (
              <span
                className="block max-w-28 truncate text-sm font-semibold text-white sm:max-w-52"
                onDoubleClick={() => setRenaming(true)}
              >
                {project.name}
              </span>
            )}
            <span className="block text-[10px] text-slate-400">
              {project.features.length} placed · {project.kml?.name ?? 'no boundary'}
            </span>
          </span>
          <ChevronDown size={14} className="text-slate-400" />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <Panel className="absolute top-full left-0 z-20 mt-1.5 w-64 p-1">
              <div className="max-h-56 overflow-y-auto">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      store.getState().setActiveProject(p.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition hover:bg-white/10 ${
                      p.id === project.id ? 'text-sky-300' : 'text-slate-300'
                    }`}
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="ml-2 shrink-0 text-[10px] text-slate-500">
                      {p.features.length}
                    </span>
                  </button>
                ))}
              </div>
              <div className="my-1 h-px bg-white/10" />
              <Button className="w-full justify-start" onClick={newProject}>
                <Plus size={13} /> New project
              </Button>
              <Button
                className="w-full justify-start"
                variant="danger"
                onClick={deleteProject}
                disabled={projects.length < 2}
              >
                <Trash2 size={13} /> Delete this project
              </Button>
            </Panel>
          </>
        )}
      </div>

      <div className="mx-1 h-7 w-px bg-white/10" />

      <Button
        onClick={undo}
        disabled={!canUndo}
        title="Undo (⌘Z)"
        className="h-8 w-8 shrink-0 p-0"
      >
        <Undo2 size={14} />
      </Button>
      <Button
        onClick={redo}
        disabled={!canRedo}
        title="Redo (⇧⌘Z)"
        className="h-8 w-8 shrink-0 p-0"
      >
        <Redo2 size={14} />
      </Button>

      <div className="mx-1 h-7 w-px bg-white/10" />

      {/* Labels drop away on phones so the bar fits a 390 px viewport. */}
      <Button onClick={importKml} title="Swap the boundary file — placed features are kept">
        <Map size={13} /> <span className="hidden sm:inline">KML</span>
      </Button>
      <Button onClick={saveLayout} title="Export placed features as JSON">
        <Download size={13} /> <span className="hidden sm:inline">Save</span>
      </Button>
      <Button onClick={loadLayout} title="Import a layout JSON">
        <Upload size={13} /> <span className="hidden sm:inline">Load</span>
      </Button>
    </Panel>
  );
}
