import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';

interface SortableItemProps {
  key?: string | number;
  id: string;
  url: string;
  index: number;
  onRemove: () => void;
}

function SortableItem({ id, url, index, onRemove }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-4 bg-black/40 border border-white/10 rounded-lg p-2 group">
      <div {...attributes} {...listeners} className="cursor-grab p-2 text-zinc-500 hover:text-white">
        <GripVertical size={20} />
      </div>
      <div className="w-8 text-center text-zinc-500 font-bold">{index + 1}</div>
      <div className="w-16 h-16 shrink-0 rounded bg-black/50 overflow-hidden relative border border-white/5">
         <img src={url} alt={`page ${index + 1}`} className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 font-mono text-xs text-zinc-400 truncate px-2">
         {url}
      </div>
      <button type="button" onClick={onRemove} className="p-2 text-red-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
        <X size={20} />
      </button>
    </div>
  );
}

interface SortableImageListProps {
  images: string[];
  onChange: (images: string[]) => void;
}

export function SortableImageList({ images, onChange }: SortableImageListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const itemIds = React.useMemo(() => images.map((url, index) => `${url}-${index}`), [images]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = itemIds.indexOf(active.id as string);
      const newIndex = itemIds.indexOf(over.id as string);
      
      onChange(arrayMove(images, oldIndex, newIndex));
    }
  };
  
  const handleRemove = (indexToRemove: number) => {
    onChange(images.filter((_, index) => index !== indexToRemove));
  };

  if (images.length === 0) return null;

  return (
    <div className="mt-4 space-y-2">
       <p className="text-xs font-bold text-zinc-400 uppercase mb-2">Reorder Images (Drag & Drop)</p>
       <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={itemIds}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {images.map((url, index) => {
              const uniqueId = `${url}-${index}`;
              return (
                <SortableItem key={uniqueId} id={uniqueId} url={url} index={index} onRemove={() => handleRemove(index)} />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
