import { useEffect, useRef } from 'preact/hooks';
import { useSignalEffect } from '@preact/signals';
import { workspace } from '../store/workspace';
import { createEditor, type EditorHandle } from '../editor/cm';

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function EditorPane() {
  const parentRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<EditorHandle | null>(null);

  useEffect(() => {
    if (!parentRef.current) return;
    const content = workspace.openFileContent.value;
    if (content === null) {
      if (handleRef.current) {
        handleRef.current.destroy();
        handleRef.current = null;
      }
      return;
    }
    if (handleRef.current) {
      handleRef.current.update(content);
      return;
    }
    let isExternalUpdate = false;
    handleRef.current = createEditor(parentRef.current, {
      initialText: content,
      theme: workspace.theme.value,
      onDirty: () => {
        if (isExternalUpdate) return;
        if (!handleRef.current) return;
        workspace.setContent(handleRef.current.getValue());
      },
      onSave: () => {
        if (saveTimer) clearTimeout(saveTimer);
        if (!handleRef.current) return;
        workspace.setContent(handleRef.current.getValue());
        void workspace.saveCurrent();
      },
    });
    return () => {
      if (handleRef.current) {
        handleRef.current.destroy();
        handleRef.current = null;
      }
    };
  }, [workspace.openFilePath.value]);

  useSignalEffect(() => {
    if (!workspace.isDirty.value) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void workspace.saveCurrent();
    }, 1000);
    return () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = null;
    };
  });

  if (workspace.openFileContent.value === null) {
    return (
      <div class="editor-pane-content empty">
        <p>open a file to start editing</p>
      </div>
    );
  }

  return <div class="editor-pane-content" ref={parentRef} />;
}
