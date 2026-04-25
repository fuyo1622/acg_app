export async function serializeBackupItems(items) {
  return Promise.all(items.map(async (item) => {
    const serialized = {
      id: item.id,
      series: item.series || '',
      character: item.character || '',
      merchandise_type: item.merchandise_type || '',
      notes: item.notes || '',
      created_at: item.created_at ? item.created_at.toISOString() : null,
      updated_at: item.updated_at ? item.updated_at.toISOString() : null,
    };

    if (item.photo && (item.photo instanceof Blob)) {
      serialized.photo = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read Blob as Data URL'));
        reader.readAsDataURL(item.photo);
      });
    } else {
      serialized.photo = null;
    }
    
    return serialized;
  }));
}

export function buildBackupPayload(serializedItems, version) {
  return {
    version,
    timestamp: new Date().toISOString(),
    items: serializedItems
  };
}

export function parseBackupText(text) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON format');
  }
}

export function validateBackupPayload(payload, expectedVersion) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Payload is not an object');
  }
  if (payload.version !== expectedVersion) {
    throw new Error(`Unsupported backup version: ${payload.version}`);
  }
  if (!Array.isArray(payload.items)) {
    throw new Error('Backup items missing or invalid format');
  }

  for (const [index, item] of payload.items.entries()) {
    if (typeof item !== 'object' || item === null) {
      throw new Error(`Item at index ${index} is invalid`);
    }

    if (item.id !== undefined && (!Number.isInteger(item.id) || item.id <= 0)) {
      throw new Error(`Item at index ${index} has an invalid id`);
    }

    if (
      (item.series !== undefined && typeof item.series !== 'string') || 
      (item.character !== undefined && typeof item.character !== 'string') || 
      (item.merchandise_type !== undefined && typeof item.merchandise_type !== 'string') || 
      (item.notes !== undefined && typeof item.notes !== 'string')
    ) {
      throw new Error(`Item at index ${index} contains invalid string definitions`);
    }

    const seriesValue = item.series || '';
    const charValue = item.character || '';
    if (!seriesValue.trim() && !charValue.trim()) {
      throw new Error(`Item at index ${index} must have at least one of series or character`);
    }

    if (!item.merchandise_type || !item.merchandise_type.trim()) {
      throw new Error(`Item at index ${index} is missing merchandise_type`);
    }

    if (item.created_at && isNaN(Date.parse(item.created_at))) {
      throw new Error(`Item at index ${index} has invalid created_at date`);
    }
    if (item.updated_at && isNaN(Date.parse(item.updated_at))) {
      throw new Error(`Item at index ${index} has invalid updated_at date`);
    }

    if (item.photo !== null && typeof item.photo !== 'undefined') {
       if (typeof item.photo !== 'string' || !item.photo.startsWith('data:image/')) {
          throw new Error(`Item at index ${index} contains invalid photo Data URL`);
       }
    }
  }

  return true;
}

export async function rehydrateBackupItems(items) {
  return Promise.all(items.map(async (item) => {
    const rehydrated = { ...item };
    
    if (rehydrated.created_at) rehydrated.created_at = new Date(rehydrated.created_at);
    if (rehydrated.updated_at) rehydrated.updated_at = new Date(rehydrated.updated_at);
    
    if (rehydrated.photo && typeof rehydrated.photo === 'string') {
       try {
         const response = await fetch(rehydrated.photo);
         if (!response.ok) throw new Error('Data URl fetch failed');
         rehydrated.photo = await response.blob(); 
         // Force mapping explicitly to a strict Blob object, not a File, bypassing accidental recursive compression via AddEdit flow
       } catch {
         throw new Error(`Failed to rehydrate photo payload for item at index`);
       }
    }
    
    return rehydrated;
  }));
}

export async function replaceItemsInDb(db, hydratedItems) {
  await db.transaction('rw', db.items, async () => {
    await db.items.clear();
    await db.items.bulkAdd(hydratedItems);
  });
}
