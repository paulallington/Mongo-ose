import { useCallback, type MutableRefObject } from 'react';
import { Menu, Item, Separator } from 'react-contexify';
import { ConfirmDialog } from '../shared/ConfirmDialog.js';
import { useState } from 'react';
import { extractId } from './DocumentTable.js';

const DOC_MENU_ID = 'document-context-menu';

interface DocumentContextMenuProps {
  contextDocRef: MutableRefObject<any>;
  selectedIds: Set<string>;
  documents: any[];
  onEdit: (doc: any) => void;
  onDuplicate: (doc: any) => void;
  onDelete: (ids: string[]) => void;
  onCopy: (docs: any[]) => void;
}

export function DocumentContextMenu({
  contextDocRef,
  selectedIds,
  documents,
  onEdit,
  onDuplicate,
  onDelete,
  onCopy,
}: DocumentContextMenuProps) {
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);

  const handleEdit = useCallback(() => {
    if (contextDocRef.current) {
      onEdit(contextDocRef.current);
    }
  }, [contextDocRef, onEdit]);

  const handleDuplicate = useCallback(() => {
    if (contextDocRef.current) {
      onDuplicate(contextDocRef.current);
    }
  }, [contextDocRef, onDuplicate]);

  const handleCopy = useCallback(() => {
    if (contextDocRef.current) {
      onCopy([contextDocRef.current]);
    }
  }, [contextDocRef, onCopy]);

  const handleDeleteSingle = useCallback(() => {
    if (contextDocRef.current) {
      setConfirmDelete([extractId(contextDocRef.current._id)]);
    }
  }, [contextDocRef]);

  const handleCopySelected = useCallback(() => {
    const selectedDocs = documents.filter((d) => selectedIds.has(extractId(d._id)));
    onCopy(selectedDocs);
  }, [documents, selectedIds, onCopy]);

  const handleDeleteSelected = useCallback(() => {
    setConfirmDelete(Array.from(selectedIds));
  }, [selectedIds]);

  return (
    <>
      <Menu id={DOC_MENU_ID}>
        <Item onClick={handleEdit}>
          <span className="ctx-icon">&#9998;</span> Edit Document
        </Item>
        <Item onClick={handleDuplicate}>
          <span className="ctx-icon">&#128203;</span> Duplicate Document
        </Item>
        <Item onClick={handleCopy}>
          <span className="ctx-icon">&#128196;</span> Copy to Clipboard
        </Item>
        <Item onClick={handleDeleteSingle}>
          <span className="ctx-icon ctx-danger">&#128465;</span>
          <span className="ctx-danger">Delete Document</span>
        </Item>

        {selectedIds.size > 1 && (
          <>
            <Separator />
            <Item onClick={handleCopySelected}>
              <span className="ctx-icon">&#128196;</span> Copy Selected ({selectedIds.size})
            </Item>
            <Item onClick={handleDeleteSelected}>
              <span className="ctx-icon ctx-danger">&#128465;</span>
              <span className="ctx-danger">Delete Selected ({selectedIds.size})</span>
            </Item>
          </>
        )}
      </Menu>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete Document(s)"
          message={`Are you sure you want to delete ${confirmDelete.length} document(s)? This action cannot be undone.`}
          onConfirm={() => {
            onDelete(confirmDelete);
            setConfirmDelete(null);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
}
