import { create } from 'zustand';

/** Which sketch (a typed note's ink block, NOTE-8) is open for drawing. Opened from the note editor. */
export const useSketchDialog = create<{ docId: string | null }>(() => ({ docId: null }));

export const openSketch = (docId: string) => useSketchDialog.setState({ docId });
export const closeSketch = () => useSketchDialog.setState({ docId: null });
