import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowDownAZ, ArrowLeft, ArrowUp, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import AppDialog from '../components/AppDialog';
import { useLanguage } from '../contexts/LanguageContext';
import { useSavedTermOrders } from '../hooks/useTermLists';
import { db } from '../services/db';
import { deleteTerm, renameTerm, saveTermOrder } from '../services/terms';
import {
  TERM_FIELDS,
  buildTermList,
  checkTermName,
  countTermUsage,
  getTermLabel,
  sortTermsByName,
  termMaxLength,
} from '../utils/termUtils';
import { isSameValue, normalizeKey } from '../utils/valueUtils';
import './ManageTerms.css';

const FIELD_LABELS = {
  merchandise_type: 'termTabTypes',
  series: 'termTabSeries',
  character: 'termTabCharacters',
};

const ADD_LABELS = {
  merchandise_type: 'addTypeLabel',
  series: 'addSeriesLabel',
  character: 'addCharacterLabel',
};

function TermRow({
  value,
  label,
  count,
  position,
  total,
  expanded,
  editing,
  onToggle,
  onMove,
  onRename,
  onDelete,
  renameForm,
}) {
  const { t } = useLanguage();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: value });
  // Rows only move up and down, so the sideways part of the drag is dropped.
  const style = {
    transform: CSS.Translate.toString(transform ? { ...transform, x: 0 } : null),
    transition,
  };

  return (
    <li ref={setNodeRef} style={style} className={`term-row glass-panel${isDragging ? ' is-dragging' : ''}`}>
      <div className="term-row-main">
        <button
          type="button"
          className="term-drag"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={t('dragTerm', { name: label })}
        >
          <GripVertical size={20} aria-hidden="true" />
        </button>
        <button type="button" className="term-name" aria-expanded={expanded} onClick={onToggle}>
          <span className="term-label">{label}</span>
          <span className="term-count">
            <span aria-hidden="true">{count}</span>
            <span className="sr-only">{t('termCountLabel', { count })}</span>
          </span>
        </button>
      </div>

      {editing ? renameForm : expanded && (
        <div className="term-actions">
          <button type="button" className="btn btn-secondary" onClick={onRename}>
            <Pencil size={16} aria-hidden="true" />
            {t('renameTerm')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => onMove(-1)} disabled={position === 1}>
            <ArrowUp size={16} aria-hidden="true" />
            {t('moveTermUp')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => onMove(1)} disabled={position === total}>
            <ArrowDown size={16} aria-hidden="true" />
            {t('moveTermDown')}
          </button>
          <button type="button" className="btn btn-secondary term-delete" onClick={onDelete}>
            <Trash2 size={16} aria-hidden="true" />
            {t('deleteTerm')}
          </button>
        </div>
      )}
    </li>
  );
}

// Adds, renames, deletes, and orders the types, series, and characters that the
// collection and the wishlist share. The order is used by the filters and the forms.
export default function ManageTerms() {
  const navigate = useNavigate();
  const { t, lang } = useLanguage();
  const [field, setField] = useState('merchandise_type');
  const [override, setOverride] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState('');
  const [editError, setEditError] = useState(null);
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [notice, setNotice] = useState(null);

  const items = useLiveQuery(() => db.items.toArray(), []);
  const wishlist = useLiveQuery(() => db.wishlist.toArray(), []);
  const saved = useSavedTermOrders();
  const records = useMemo(() => [...(items ?? []), ...(wishlist ?? [])], [items, wishlist]);
  const savedList = useMemo(() => buildTermList(field, records, saved?.[field]), [field, records, saved]);
  // A changed order shows at once. It gives way as soon as the saved order it replaced
  // changes, which is when the database holds the new one.
  const list = override?.field === field && override.basedOn === saved?.[field] ? override.values : savedList;
  const collectionCounts = useMemo(() => countTermUsage(field, items ?? []), [field, items]);
  const wishlistCounts = useMemo(() => countTermUsage(field, wishlist ?? []), [field, wishlist]);
  const loading = items === undefined || wishlist === undefined || saved === undefined;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const labelOf = value => getTermLabel(field, value, t);
  const usage = value => ({
    collection: collectionCounts.get(normalizeKey(value)) ?? 0,
    wishlist: wishlistCounts.get(normalizeKey(value)) ?? 0,
  });
  // A built-in type can also be named by its label in the current language.
  const findExisting = (name, except = '') => list.find(value => !isSameValue(value, except)
    && (isSameValue(value, name) || isSameValue(labelOf(value), name)));

  const switchField = (nextField) => {
    setField(nextField);
    setExpanded(null);
    setEditing(null);
    setAddError(null);
  };

  const saveOrder = async (values) => {
    setOverride({ field, values, basedOn: saved?.[field] });
    try {
      await saveTermOrder(field, values);
    } catch (error) {
      console.error(error);
      setOverride(null);
      setNotice(t('termSaveError'));
    }
  };

  const runChange = async (change) => {
    try {
      await change();
      return true;
    } catch (error) {
      console.error(error);
      setNotice(t('termSaveError'));
      return false;
    }
  };

  const handleAdd = (event) => {
    event.preventDefault();
    const { name, error } = checkTermName(field, newName);
    if (error) {
      setAddError(t(error, { max: termMaxLength(field) }));
      return;
    }
    if (findExisting(name)) {
      setAddError(t('termExists', { name }));
      return;
    }
    setNewName('');
    setAddError(null);
    saveOrder([...list, name]);
  };

  const move = (value, offset) => {
    const index = list.indexOf(value);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= list.length) return;
    saveOrder(arrayMove(list, index, target));
  };

  const startRename = (value) => {
    setEditing(value);
    setEditName(labelOf(value));
    setEditError(null);
  };

  const submitRename = async (event) => {
    event.preventDefault();
    const from = editing;
    const { name, error } = checkTermName(field, editName);
    if (error) {
      setEditError(t(error, { max: termMaxLength(field) }));
      return;
    }
    if (name === labelOf(from)) {
      setEditing(null);
      return;
    }
    const existing = findExisting(name, from);
    if (existing) {
      setConfirm({ kind: 'merge', from, to: existing });
      return;
    }
    if (await runChange(() => renameTerm(field, list, from, name))) {
      setEditing(null);
      setExpanded(null);
    }
  };

  const confirmChange = async () => {
    const pending = confirm;
    setConfirm(null);
    if (!pending) return;
    const done = pending.kind === 'merge'
      ? await runChange(() => renameTerm(field, list, pending.from, pending.to))
      : await runChange(() => deleteTerm(field, list, pending.value));
    if (done) {
      setEditing(null);
      setExpanded(null);
    }
  };

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    saveOrder(arrayMove(list, list.indexOf(active.id), list.indexOf(over.id)));
  };

  const place = id => ({ position: list.indexOf(id) + 1, total: list.length });
  const accessibility = {
    screenReaderInstructions: { draggable: t('dragInstructions') },
    announcements: {
      onDragStart: ({ active }) => t('dragPickedUp', { name: labelOf(active.id) }),
      onDragOver: ({ active, over }) => (over ? t('dragMovedOver', { name: labelOf(active.id), ...place(over.id) }) : undefined),
      onDragEnd: ({ active, over }) => (over ? t('dragDropped', { name: labelOf(active.id), ...place(over.id) }) : undefined),
      onDragCancel: ({ active }) => t('dragCancelled', { name: labelOf(active.id) }),
    },
  };

  const renameForm = (
    <form className="term-rename" onSubmit={submitRename}>
      <input
        type="text"
        value={editName}
        onChange={event => setEditName(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Escape') setEditing(null);
        }}
        aria-label={t('termNewName', { name: editing ? labelOf(editing) : '' })}
        maxLength={termMaxLength(field)}
        autoFocus
      />
      <div className="term-rename-actions">
        <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>{t('cancel')}</button>
        <button type="submit" className="btn btn-primary">{t('saveTerm')}</button>
      </div>
      {editError && <p className="term-error" role="alert">{editError}</p>}
    </form>
  );

  const confirmUsage = confirm ? usage(confirm.kind === 'merge' ? confirm.from : confirm.value) : null;
  const confirmMessage = !confirm ? '' : confirm.kind === 'merge'
    ? t('mergeTermMessage', { from: labelOf(confirm.from), to: labelOf(confirm.to) })
    : confirmUsage.collection + confirmUsage.wishlist > 0
      ? t('deleteTermInUse', { name: labelOf(confirm.value), ...confirmUsage })
      : t('deleteTermUnused', { name: labelOf(confirm.value) });

  return (
    <div className="form-page manage-terms">
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate('/')} aria-label={t('backHome')}>
          <ArrowLeft size={24} />
        </button>
        <h2>{t('manageTerms')}</h2>
      </header>

      <p className="manage-terms-hint">{t('manageTermsHint')}</p>

      <div className="term-tabs glass-panel" role="group" aria-label={t('manageTerms')}>
        {TERM_FIELDS.map(option => (
          <button
            key={option}
            type="button"
            className={`term-tab${option === field ? ' is-active' : ''}`}
            aria-pressed={option === field}
            onClick={() => switchField(option)}
          >
            {t(FIELD_LABELS[option])}
          </button>
        ))}
      </div>

      <form className="term-add" onSubmit={handleAdd}>
        <input
          type="text"
          value={newName}
          onChange={event => setNewName(event.target.value)}
          aria-label={t(ADD_LABELS[field])}
          placeholder={t(ADD_LABELS[field])}
          maxLength={termMaxLength(field)}
        />
        <button type="submit" className="btn btn-primary">
          <Plus size={18} aria-hidden="true" />
          {t('addTerm')}
        </button>
      </form>
      {addError && <p className="term-error" role="alert">{addError}</p>}

      <div className="term-toolbar">
        <p>{t('dragTermHint')}</p>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => saveOrder(sortTermsByName(list, labelOf, lang))}
          disabled={list.length < 2}
        >
          <ArrowDownAZ size={18} aria-hidden="true" />
          {t('sortTermsByName')}
        </button>
      </div>

      {loading ? (
        <p className="loading">{t('loadingTerms')}</p>
      ) : list.length === 0 ? (
        <p className="term-empty">{t('termEmpty')}</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} accessibility={accessibility}>
          <SortableContext items={list} strategy={verticalListSortingStrategy}>
            <ul className="term-list">
              {list.map((value, index) => {
                const { collection, wishlist: wished } = usage(value);
                return (
                  <TermRow
                    key={value}
                    value={value}
                    label={labelOf(value)}
                    count={collection + wished}
                    position={index + 1}
                    total={list.length}
                    expanded={expanded === value}
                    editing={editing === value}
                    onToggle={() => setExpanded(current => (current === value ? null : value))}
                    onMove={offset => move(value, offset)}
                    onRename={() => startRename(value)}
                    onDelete={() => setConfirm({ kind: 'delete', value })}
                    renameForm={renameForm}
                  />
                );
              })}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <AppDialog
        open={Boolean(confirm)}
        title={!confirm ? '' : confirm.kind === 'merge'
          ? t('mergeTermTitle', { name: labelOf(confirm.to) })
          : t('deleteTermTitle', { name: labelOf(confirm.value) })}
        message={confirmMessage}
        confirmLabel={t(confirm?.kind === 'merge' ? 'mergeTerm' : 'deleteTerm')}
        cancelLabel={t('cancel')}
        onConfirm={confirmChange}
        onCancel={() => setConfirm(null)}
        destructive
      />
      <AppDialog
        open={Boolean(notice)}
        title={t('errorTitle')}
        message={notice}
        confirmLabel={t('close')}
        onConfirm={() => setNotice(null)}
      />
    </div>
  );
}
